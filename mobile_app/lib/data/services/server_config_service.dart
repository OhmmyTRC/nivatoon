import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Preset server targets supported by the NIVATOON Android shell.
class ServerPreset {
  const ServerPreset({
    required this.label,
    required this.description,
    required this.url,
  });

  final String label;
  final String description;
  final String url;
}

/// Manages the active NIVATOON backend/web URL and tests connectivity.
class ServerConfigService {
  static const String _storageKey = 'nivatoon_server_url_v1';

  /// Current PC Wi-Fi LAN IP detected at build time, plus USB ADB & Emulator targets.
  static const List<ServerPreset> presets = <ServerPreset>[
    ServerPreset(
      label: 'Wi-Fi วงเดียวกัน (มือถือจริง)',
      description: 'เครื่องคอมฯ Wi-Fi LAN',
      url: 'http://192.168.0.20:3000',
    ),
    ServerPreset(
      label: 'สาย USB (adb reverse)',
      description: 'รัน adb reverse tcp:3000 tcp:3000',
      url: 'http://localhost:3000',
    ),
    ServerPreset(
      label: 'Android Emulator',
      description: 'สำหรับโปรแกรมจำลองบนคอมฯ',
      url: 'http://10.0.2.2:3000',
    ),
  ];

  /// Normalizes user-entered URL strings into a valid HTTP/HTTPS origin without trailing slash.
  static String normalizeUrl(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.isEmpty) return presets.first.url;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return 'http://$trimmed';
  }

  Future<String> loadSavedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_storageKey);
    if (saved != null && saved.trim().isNotEmpty) {
      return normalizeUrl(saved);
    }
    return presets.first.url;
  }

  Future<void> saveUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, normalizeUrl(url));
  }

  /// Pings `/api/notifications` to confirm NIVATOON backend is reachable from this phone.
  Future<bool> checkReachable(String baseUrl) async {
    try {
      final uri = Uri.parse('${normalizeUrl(baseUrl)}/api/notifications');
      final response = await http.get(uri).timeout(const Duration(seconds: 3));
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }

  /// Picks the first reachable endpoint if the saved URL fails on initial boot.
  Future<String> resolveBestUrl() async {
    final saved = await loadSavedUrl();
    if (await checkReachable(saved)) {
      return saved;
    }
    for (final preset in presets) {
      if (preset.url == saved) continue;
      if (await checkReachable(preset.url)) {
        await saveUrl(preset.url);
        return preset.url;
      }
    }
    return saved;
  }
}
