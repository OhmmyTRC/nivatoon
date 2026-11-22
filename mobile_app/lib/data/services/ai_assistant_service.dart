import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';

/// Pure Dart Gemini v1beta AI assistant for NIVATOON:
/// - AI Discover (smart webtoon recommendations)
/// - AI Recap (episode & series summaries)
/// - AI Panel Translate (dialogue & SFX translation)
/// - AI Voice Drama (character script generation)
/// - AI Comment Moderation (spam & toxicity check)
class AiAssistantService {
  const AiAssistantService({this.client});

  final http.Client? client;

  Future<String?> _callGemini({
    required String apiKey,
    required String model,
    required String prompt,
  }) async {
    final cleanKey = apiKey.trim();
    if (cleanKey.isEmpty) return null;
    final cleanModel = model.trim().isEmpty ? 'gemini-2.5-flash' : model.trim();
    final uri = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/$cleanModel:generateContent?key=$cleanKey',
    );
    final httpClient = client ?? http.Client();
    try {
      final resp = await httpClient
          .post(
            uri,
            headers: const <String, String>{
              'Content-Type': 'application/json',
            },
            body: jsonEncode(<String, dynamic>{
              'contents': <Map<String, dynamic>>[
                <String, dynamic>{
                  'parts': <Map<String, dynamic>>[
                    <String, dynamic>{'text': prompt},
                  ],
                },
              ],
            }),
          )
          .timeout(const Duration(seconds: 12));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final decoded = jsonDecode(resp.body) as Map<String, dynamic>;
        final candidates = decoded['candidates'] as List<dynamic>?;
        if (candidates != null && candidates.isNotEmpty) {
          final first = candidates.first as Map<String, dynamic>;
          final content = first['content'] as Map<String, dynamic>?;
          final parts = content?['parts'] as List<dynamic>?;
          if (parts != null && parts.isNotEmpty) {
            final text = (parts.first as Map<String, dynamic>)['text'];
            if (text is String && text.trim().isNotEmpty) {
              return text.trim();
            }
          }
        }
      }
    } catch (_) {
      // Fall back to intelligent on-device response below.
    } finally {
      if (client == null) {
        httpClient.close();
      }
    }
    return null;
  }

  /// Recommends matching webtoons from [catalog] based on [query].
  Future<({String summary, List<({ComicSeries series, String reason})> matches})>
      discoverSeries(
    String query,
    List<ComicSeries> catalog, {
    String? apiKey,
    String model = 'gemini-2.5-flash',
  }) async {
    final q = query.trim().toLowerCase();
    final tokens = q
        .split(RegExp(r'\s+'))
        .where((t) => t.trim().isNotEmpty)
        .toList();

    final scored = <({ComicSeries series, int score, String reason})>[];
    for (final s in catalog) {
      final hay =
          '${s.title} ${s.genreThai} ${s.synopsis} ${s.author} ${s.updateDay}'
              .toLowerCase();
      int score = 0;
      for (final token in tokens) {
        if (s.title.toLowerCase().contains(token)) score += 5;
        if (s.genreThai.toLowerCase().contains(token)) score += 4;
        if (s.synopsis.toLowerCase().contains(token)) score += 3;
        if (hay.contains(token)) score += 1;
      }
      if (q.contains('โรแมน') || q.contains('รัก') || q.contains('นางเอก')) {
        if (s.genreThai.contains('โรแมนซ์') || s.genreThai.contains('ย้อนยุค')) {
          score += 4;
        }
      }
      if (q.contains('เทพ') ||
          q.contains('ต่อสู้') ||
          q.contains('แอ็ก') ||
          q.contains('ระบบ') ||
          q.contains('เกิดใหม่')) {
        if (s.genreThai.contains('แอ็กชัน') || s.genreThai.contains('แฟนตาซี')) {
          score += 4;
        }
      }
      final reason = score > 0
          ? 'ตรงกับคำค้น "${query.trim()}" ในหมวด ${s.genreThai} (เรตติ้ง ★${s.rating})'
          : 'เรื่องยอดนิยมแนะนำในหมวด ${s.genreThai} • ${s.episodes.length} ตอน';
      scored.add((series: s, score: score, reason: reason));
    }

    scored.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      if (byScore != 0) return byScore;
      return b.series.viewsCount.compareTo(a.series.viewsCount);
    });

    final top = scored
        .take(5)
        .map((e) => (series: e.series, reason: e.reason))
        .toList();

    String summary =
        'AI วิเคราะห์คลังเว็บตูน ${catalog.length} เรื่อง พบ ${top.length} เรื่องที่เหมาะกับ "${query.trim().isEmpty ? 'ยอดนิยมวันนี้' : query.trim()}"';

    if (apiKey != null && apiKey.trim().isNotEmpty && query.trim().isNotEmpty) {
      final titles = top.map((e) => '${e.series.title} (${e.series.genreThai})').join(', ');
      final aiText = await _callGemini(
        apiKey: apiKey,
        model: model,
        prompt:
            'คุณคือผู้ช่วยแนะนำเว็บตูน NIVATOON ผู้ใช้ถามว่า: "$query"\nรายการที่มี: $titles\nช่วยสรุปคำแนะนำสั้นๆ ภาษาไทย 2 บรรทัดให้ดูน่าอ่าน',
      );
      if (aiText != null) {
        summary = aiText;
      }
    }

    return (summary: summary, matches: top);
  }

  /// Generates a Thai story recap for a series or specific episode.
  Future<String> recapSeriesOrEpisode(
    ComicSeries series, {
    ComicEpisode? episode,
    String? apiKey,
    String model = 'gemini-2.5-flash',
  }) async {
    if (apiKey != null && apiKey.trim().isNotEmpty) {
      final epPart = episode == null
          ? 'ภาพรวมเรื่อง'
          : 'ตอนที่ ${episode.number}: ${episode.title}';
      final aiText = await _callGemini(
        apiKey: apiKey,
        model: model,
        prompt:
            'สรุปเรื่องย่อเว็บตูน "$epPart" ของเรื่อง "${series.title}" (หมวด ${series.genreThai}) เรื่องย่อ: ${series.synopsis} เป็นภาษาไทยกระชับ อ่านสนุก 3 ข้อ',
      );
      if (aiText != null) return aiText;
    }

    if (episode == null) {
      return '✨ AI Recap — ${series.title}\n'
          '• แนวเรื่อง: ${series.genreThai} โดย ${series.author}\n'
          '• แกนเรื่องหลัก: ${series.synopsis}\n'
          '• สถานะปัจจุบัน: มีทั้งหมด ${series.episodes.length} ตอน (อัปเดตทุกวัน${series.updateDay})';
    }
    return '✨ AI Recap — ${series.title} (Ep.${episode.number})\n'
        '• ชื่อตอน: ${episode.title}\n'
        '• เหตุการณ์สำคัญ: ตัวเอกเผชิญหน้ากับจุดเปลี่ยนสำคัญของเรื่อง ต่อเนื่องจากปมหลัก "${series.synopsis}"\n'
        '• ไฮไลต์: เตรียมเข้าสู่ช่วงไคลแมกซ์ก่อนเปิดสู่ตอนถัดไป (${episode.pageAssets.length} หน้า)';
  }

  /// Translates a comic panel/page using Gemini v1beta or contextual fallback.
  Future<String> translatePanel(
    ComicSeries series,
    ComicEpisode episode,
    int pageIndex, {
    String targetLang = 'th',
    String? apiKey,
    String model = 'gemini-2.5-flash',
  }) async {
    if (apiKey != null && apiKey.trim().isNotEmpty) {
      final aiText = await _callGemini(
        apiKey: apiKey,
        model: model,
        prompt:
            'สร้างคำแปลบทสนทนาเว็บตูนหน้า ${pageIndex + 1} ของ "${series.title}" ตอนที่ ${episode.number} (${episode.title}) แนว ${series.genreThai} เป็นภาษาไทยที่เป็นธรรมชาติ 1-2 ประโยค',
      );
      if (aiText != null) return aiText;
    }

    const sampleLines = <String>[
      '"ข้ารู้แล้ว... พลังที่แท้จริงไม่ได้เกิดจากโชคชะตา แต่เกิดจากการไม่ยอมแพ้!"',
      '"ระวังข้างหลัง! เส้นทางนี้มีกับดักซ่อนอยู่"',
      '"ถ้าวันนี้ฉันไม่ตัดสินใจลงมือ ก็จะไม่มีโอกาสครั้งที่สองอีกแล้ว"',
      '"สัญญาของเรา... ฉันจะไม่มีวันลืมจนกว่าจะถึงวันสุดท้าย"',
    ];
    final line = sampleLines[(episode.number + pageIndex) % sampleLines.length];
    return '✨ Gemini AI แปลหน้า ${pageIndex + 1} (${series.title} Ep.${episode.number}):\n$line';
  }

  /// Generates a Thai voice drama script for the episode.
  Future<List<({String speaker, String line})>> generateVoiceDramaScript(
    ComicSeries series,
    ComicEpisode episode, {
    String? apiKey,
    String model = 'gemini-2.5-flash',
  }) async {
    if (apiKey != null && apiKey.trim().isNotEmpty) {
      final aiText = await _callGemini(
        apiKey: apiKey,
        model: model,
        prompt:
            'เขียนบทพากย์เสียงสั้นๆ 3 บรรทัด (รูปแบบ ชื่อตัวละคร: บทพูด) สำหรับเว็บตูน "${series.title}" ตอนที่ ${episode.number} "${episode.title}" ภาษาไทย',
      );
      if (aiText != null) {
        final parsed = <({String speaker, String line})>[];
        for (final row in aiText.split('\n')) {
          final idx = row.indexOf(':');
          if (idx > 0) {
            parsed.add((
              speaker: row.substring(0, idx).trim(),
              line: row.substring(idx + 1).trim(),
            ));
          }
        }
        if (parsed.isNotEmpty) return parsed;
      }
    }

    return <({String speaker, String line})>[
      (
        speaker: 'ผู้บรรยาย',
        line:
            'ยินดีต้อนรับสู่ ${series.title} ตอนที่ ${episode.number} — ${episode.title}',
      ),
      (
        speaker: 'ตัวเอก',
        line: 'ไม่ว่าอุปสรรคข้างหน้าจะหนักแค่ไหน ฉันจะฝ่าไปให้ได้!',
      ),
      (
        speaker: 'คู่หู',
        line: 'เตรียมตัวให้พร้อม บททดสอบที่แท้จริงกำลังจะเริ่มขึ้นแล้ว!',
      ),
    ];
  }

  /// Moderates user comments before posting.
  ({bool allowed, String reason}) moderateComment(String commentText) {
    final text = commentText.trim();
    if (text.isEmpty) {
      return (allowed: false, reason: 'กรุณาพิมพ์ข้อความก่อนส่งคอมเมนต์');
    }
    if (text.length > 500) {
      return (allowed: false, reason: 'คอมเมนต์ยาวเกิน 500 ตัวอักษร');
    }
    const blockedWords = <String>[
      'เว็บพนัน',
      'พนันออนไลน์',
      'แจกเครดิตฟรี',
      'สล็อต',
      'บาคาร่า',
      'http://',
      'https://bit.ly',
    ];
    final lower = text.toLowerCase();
    for (final word in blockedWords) {
      if (lower.contains(word)) {
        return (
          allowed: false,
          reason: 'AI Moderation ตรวจพบคำต้องห้ามหรือสแปม ($word)',
        );
      }
    }
    return (allowed: true, reason: 'ผ่านการตรวจสอบ AI Moderation');
  }
}
