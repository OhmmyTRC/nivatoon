import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// Cloud File Storage (GitHub `OhmmyTRC/nivatoon`) & Cloud Database (Firebase `niva-421c2`) client
/// for the NIVATOON Android application.
class CloudStorageAndDbService {
  static const String githubOwner = 'OhmmyTRC';
  static const String githubRepo = 'nivatoon';
  static const String githubBranch = 'main';
  static const String githubRepoFull = '$githubOwner/$githubRepo';

  static const String githubRawBase =
      'https://raw.githubusercontent.com/$githubOwner/$githubRepo/$githubBranch/public';
  static const String githubCdnBase =
      'https://cdn.jsdelivr.net/gh/$githubOwner/$githubRepo@$githubBranch/public';
  static const String githubManifestUrl = '$githubRawBase/comics/manifest.json';

  static const String firebaseProjectId = 'niva-421c2';
  static const String firebaseRtdbBase =
      'https://niva-421c2-default-rtdb.asia-southeast1.firebasedatabase.app/nivatoon_cloud';

  /// Converts a relative `/comics/...` or `/uploads/...` path into a full GitHub Raw URL.
  static String toGitHubRawUrl(String pathOrUrl) {
    final trimmed = pathOrUrl.trim();
    if (trimmed.isEmpty) return trimmed;
    if (trimmed.startsWith('https://') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('assets/') ||
        trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    if (trimmed.startsWith('/comics/') ||
        trimmed.startsWith('comics/') ||
        trimmed.startsWith('/uploads/') ||
        trimmed.startsWith('uploads/')) {
      final cleanRel = trimmed
          .split('?')
          .first
          .replaceFirst(RegExp(r'^/+'), '')
          .replaceFirst(RegExp(r'^public/+'), '');
      final segments = cleanRel.split('/').where((s) => s.isNotEmpty).map((s) {
        try {
          return Uri.encodeComponent(Uri.decodeComponent(s));
        } catch (_) {
          return Uri.encodeComponent(s);
        }
      }).join('/');
      return '$githubRawBase/$segments';
    }
    return trimmed;
  }

  static String _safeRtdbKey(String rawKey) {
    return rawKey.trim().replaceAll(RegExp(r'[.#$/\[\]]'), '_');
  }

  /// Fetches `public/comics/manifest.json` directly from GitHub Raw Storage (`OhmmyTRC/nivatoon`).
  Future<Map<String, dynamic>?> fetchGitHubComicsManifest() async {
    final urls = <String>[
      '$githubManifestUrl?t=${DateTime.now().millisecondsSinceEpoch}',
      '$githubCdnBase/comics/manifest.json',
    ];
    for (final url in urls) {
      try {
        final res =
            await http.get(Uri.parse(url)).timeout(const Duration(seconds: 7));
        if (res.statusCode == 200 && res.body.isNotEmpty) {
          final decoded = jsonDecode(utf8.decode(res.bodyBytes));
          if (decoded is Map<String, dynamic> && decoded['series'] is List) {
            return decoded;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  /// Fetches the full `/nivatoon_cloud` database snapshot from Firebase (`niva-421c2`).
  Future<Map<String, dynamic>?> fetchFirebaseCloudSnapshot() async {
    try {
      final uri = Uri.parse('$firebaseRtdbBase.json');
      final res = await http.get(uri).timeout(const Duration(seconds: 7));
      if (res.statusCode == 200 && res.body.isNotEmpty && res.body != 'null') {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      }
    } catch (_) {}
    return null;
  }

  /// Writes or updates a document in Firebase (`nivatoon_cloud/<collection>/<docId>.json`).
  Future<bool> upsertFirebaseDoc(
    String collection,
    String docId,
    Map<String, dynamic> data,
  ) async {
    try {
      final safeKey = _safeRtdbKey(docId);
      final uri = Uri.parse('$firebaseRtdbBase/$collection/$safeKey.json');
      final payload = <String, dynamic>{
        ...data,
        'syncedAt': DateTime.now().toIso8601String(),
      };
      final res = await http
          .patch(
            uri,
            headers: const <String, String>{'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 6));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Deletes a document from Firebase (`nivatoon_cloud/<collection>/<docId>.json`).
  Future<bool> deleteFirebaseDoc(String collection, String docId) async {
    try {
      final safeKey = _safeRtdbKey(docId);
      final uri = Uri.parse('$firebaseRtdbBase/$collection/$safeKey.json');
      final res = await http.delete(uri).timeout(const Duration(seconds: 5));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Uploads a local image file from the phone directly to GitHub (`OhmmyTRC/nivatoon/public/<targetPath>`)
  /// using the GitHub Contents REST API when a GitHub Personal Access Token is configured.
  Future<({bool ok, String url, String method})> uploadFileToGitHub({
    required String localFilePath,
    required String targetPublicPath,
    required String commitMessage,
    String? githubToken,
  }) async {
    final cleanTarget = targetPublicPath
        .replaceAll('\\', '/')
        .replaceFirst(RegExp(r'^/+'), '')
        .replaceFirst(RegExp(r'^public/+'), '');
    final repoPath = 'public/$cleanTarget';
    final rawUrl = toGitHubRawUrl('/$cleanTarget');

    try {
      final file = File(localFilePath);
      if (!await file.exists()) {
        return (ok: false, url: localFilePath, method: 'local-file');
      }
      final bytes = await file.readAsBytes();

      if (githubToken != null && githubToken.trim().isNotEmpty) {
        final token = githubToken.trim();
        final encodedPath = repoPath
            .split('/')
            .map(Uri.encodeComponent)
            .join('/');
        final apiUri = Uri.parse(
          'https://api.github.com/repos/$githubOwner/$githubRepo/contents/$encodedPath',
        );

        String? existingSha;
        try {
          final getRes = await http.get(
            Uri.parse('$apiUri?ref=$githubBranch'),
            headers: <String, String>{
              'Authorization': 'Bearer $token',
              'Accept': 'application/vnd.github+json',
            },
          ).timeout(const Duration(seconds: 6));
          if (getRes.statusCode == 200) {
            final j = jsonDecode(getRes.body);
            if (j is Map && j['sha'] is String) {
              existingSha = j['sha'] as String;
            }
          }
        } catch (_) {}

        final putRes = await http
            .put(
              apiUri,
              headers: <String, String>{
                'Authorization': 'Bearer $token',
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
              },
              body: jsonEncode(<String, dynamic>{
                'message': commitMessage,
                'content': base64Encode(bytes),
                'branch': githubBranch,
                'sha': ?existingSha,
              }),
            )
            .timeout(const Duration(seconds: 12));

        if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
          return (ok: true, url: rawUrl, method: 'github-api');
        }
      }
    } catch (_) {}

    return (ok: false, url: localFilePath, method: 'local-cache');
  }
}
