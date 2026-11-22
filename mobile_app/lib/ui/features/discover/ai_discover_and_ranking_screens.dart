import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/data/services/ai_assistant_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';
import 'package:nivatoon_mobile/ui/core/nivatoon_widgets.dart';
import 'package:nivatoon_mobile/ui/features/account/wallet_profile_admin_screens.dart';

/// AI Smart Discover screen matching Next.js `/ai-discover`.
class AiDiscoverScreen extends StatefulWidget {
  const AiDiscoverScreen({
    super.key,
    required this.repo,
    required this.onOpenSeries,
  });

  final NivatoonRepository repo;
  final void Function(ComicSeries series) onOpenSeries;

  @override
  State<AiDiscoverScreen> createState() => _AiDiscoverScreenState();
}

class _AiDiscoverScreenState extends State<AiDiscoverScreen> {
  final TextEditingController _promptCtrl = TextEditingController();
  final AiAssistantService _ai = const AiAssistantService();
  bool _loading = false;
  String _summary = 'พิมพ์แนวที่อยากอ่าน หรือเลือกแท็กด่วนด้านล่างเพื่อให้ AI แนะนำเรื่องที่ใช่สำหรับคุณ';
  List<({ComicSeries series, String reason})> _results =
      <({ComicSeries series, String reason})>[];

  static const List<String> _moodChips = <String>[
    'พระเอกเทพ กลับชาติมาเกิด',
    'โรแมนซ์แฟนตาซี นางเอกฉลาด',
    'แอ็กชันต่อสู้ ระบบอัปเลเวล',
    'ย้อนยุค วังหลวง ดราม่า',
  ];

  @override
  void initState() {
    super.initState();
    _runDiscover('ยอดนิยม');
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    super.dispose();
  }

  Future<void> _runDiscover(String query) async {
    setState(() => _loading = true);
    final res = await _ai.discoverSeries(
      query,
      widget.repo.seriesList,
      apiKey: widget.repo.geminiRawApiKey,
      model: widget.repo.geminiModelReasoning,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      _summary = res.summary;
      _results = res.matches;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'AI ค้นหาเรื่องที่ใช่',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: <Color>[Color(0xFF18181B), Color(0xFF064E3B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Row(
                  children: <Widget>[
                    Icon(Icons.auto_awesome_rounded, color: Color(0xFFB9FF66)),
                    SizedBox(width: 8),
                    Text(
                      'NIVATOON AI Discover (Gemini v1beta)',
                      style: TextStyle(
                        color: Color(0xFFB9FF66),
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _promptCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'อยากอ่านแนวไหน? เช่น พระเอกระบบเทพ, ย้อนยุค...',
                    hintStyle: const TextStyle(color: Colors.white60, fontSize: 13),
                    filled: true,
                    fillColor: Colors.white.withValues(alpha: 0.12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    suffixIcon: IconButton(
                      onPressed: _loading
                          ? null
                          : () => _runDiscover(_promptCtrl.text),
                      icon: const Icon(Icons.send_rounded, color: Color(0xFF00DC64)),
                    ),
                  ),
                  onSubmitted: (v) => _runDiscover(v),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _moodChips.map((chip) {
                    return ActionChip(
                      backgroundColor: Colors.white.withValues(alpha: 0.14),
                      label: Text(
                        chip,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      onPressed: () {
                        _promptCtrl.text = chip;
                        _runDiscover(chip);
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Icon(Icons.psychology_rounded, color: Color(0xFF00A84B)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _loading
                        ? const LinearProgressIndicator(minHeight: 4)
                        : Text(
                            _summary,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              height: 1.4,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ..._results.asMap().entries.map((entry) {
            final rank = entry.key + 1;
            final item = entry.value;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: ListTile(
                onTap: () => widget.onOpenSeries(item.series),
                leading: Stack(
                  children: <Widget>[
                    AdaptiveComicImage(
                      path: item.series.coverAsset,
                      width: 52,
                      height: 68,
                      borderRadius: 10,
                    ),
                    Positioned(
                      top: 2,
                      left: 2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00DC64),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '#$rank',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                title: Text(
                  item.series.title,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                ),
                subtitle: Text(
                  item.reason,
                  style: const TextStyle(fontSize: 11),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// Ranking Charts screen matching Next.js `/ranking`.
class RankingScreen extends StatefulWidget {
  const RankingScreen({
    super.key,
    required this.repo,
    required this.onOpenSeries,
  });

  final NivatoonRepository repo;
  final void Function(ComicSeries series) onOpenSeries;

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  String _mode = 'popular';
  String _genre = 'ทั้งหมด';

  @override
  Widget build(BuildContext context) {
    final genres = <String>{
      'ทั้งหมด',
      ...widget.repo.seriesList.map((s) => s.genreThai),
    }.toList();

    final list = widget.repo.seriesList.where((s) {
      if (_genre != 'ทั้งหมด' && s.genreThai != _genre) return false;
      if (_mode == 'completed' && s.updateDay != 'จบบริบูรณ์') return false;
      return true;
    }).toList();

    list.sort((a, b) {
      if (_mode == 'rating') return b.rating.compareTo(a.rating);
      return b.viewsCount.compareTo(a.viewsCount);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'อันดับเว็บตูนยอดนิยม',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: <Widget>[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: <MapEntry<String, String>>[
                const MapEntry<String, String>('popular', 'ยอดฮิตรวม'),
                const MapEntry<String, String>('rating', 'คะแนนสูงสุด ★'),
                const MapEntry<String, String>('completed', 'จบบริบูรณ์'),
              ].map((e) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(e.value),
                    selected: _mode == e.key,
                    onSelected: (_) => setState(() => _mode = e.key),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: genres.map((g) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: Text(g, style: const TextStyle(fontSize: 11)),
                    selected: _genre == g,
                    onSelected: (_) => setState(() => _genre = g),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          if (list.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('ไม่พบเว็บตูนในหมวดหมู่นี้')),
              ),
            )
          else
            ...list.asMap().entries.map((entry) {
              final rank = entry.key + 1;
              final s = entry.value;
              final badgeColor = rank == 1
                  ? const Color(0xFFF59E0B)
                  : rank == 2
                      ? const Color(0xFF94A3B8)
                      : rank == 3
                          ? const Color(0xFFD97706)
                          : const Color(0xFF18181B);
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                child: ListTile(
                  onTap: () => widget.onOpenSeries(s),
                  leading: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: badgeColor,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$rank',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      AdaptiveComicImage(
                        path: s.coverAsset,
                        width: 46,
                        height: 60,
                        borderRadius: 8,
                      ),
                    ],
                  ),
                  title: Text(
                    s.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                  subtitle: Text(
                    '${s.genreThai} • ★ ${s.rating} • ${s.viewsCount} วิว',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                ),
              );
            }),
        ],
      ),
    );
  }
}

/// Subscription Plans screen matching Next.js `/plans`.
class PlansScreen extends StatelessWidget {
  const PlansScreen({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: repo,
      builder: (BuildContext context, _) {
        final user = repo.currentUser;
        if (user == null) {
          return const Scaffold(body: Center(child: Text('กรุณาเข้าสู่ระบบ')));
        }
        return Scaffold(
          appBar: AppBar(
            title: const Text(
              'แพ็กเกจสมาชิก NIVATOON Plus/VIP',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.all(14),
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF18181B),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: <Widget>[
                    const Icon(Icons.workspace_premium_rounded, color: Color(0xFFFFE066), size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'แพ็กเกจปัจจุบัน: ${user.plan.toUpperCase()}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                            ),
                          ),
                          Text(
                            'เหรียญคงเหลือ: ${user.coinBalance} • ตั๋วฟรี: ${user.freePassTickets}',
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => WalletScreen(repo: repo),
                          ),
                        );
                      },
                      child: const Text('เติมเหรียญ', style: TextStyle(color: Color(0xFF00DC64))),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _PlanCard(
                title: 'Free Member',
                subtitle: 'เริ่มต้นฟรี • รับ 3 ตั๋วฟรีแรกเข้า + เช็คอินรายวัน',
                priceLabel: 'ฟรีตลอดชีพ',
                isCurrent: user.plan == 'free',
                accent: const Color(0xFF64748B),
                perks: const <String>[
                  'อ่านตอนฟรีครบทุกเรื่อง',
                  'เช็คอิน 7 วันรับตั๋วฟรีต่อเนื่อง',
                  'AI Discover & AI Recap พื้นฐาน',
                ],
                onSelect: null,
              ),
              _PlanCard(
                title: 'NIVATOON Plus',
                subtitle: 'สายอ่านประจำ คุ้มค่าสุด',
                priceLabel: '100 เหรียญ / เดือน',
                isCurrent: user.plan == 'plus',
                accent: const Color(0xFF00A84B),
                perks: const <String>[
                  'รับโบนัส +10 ตั๋วฟรีทันทีที่สมัคร',
                  'AI แปลภาพ & พากย์เสียงไม่จำกัด',
                  'กรอบโปรไฟล์พิเศษ + ไม่มีโฆษณา',
                ],
                onSelect: user.plan == 'plus'
                    ? null
                    : () {
                        final res = repo.upgradePlan(
                          planId: 'plus',
                          coinCost: 100,
                          bonusTickets: 10,
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(res.message)),
                        );
                      },
              ),
              _PlanCard(
                title: 'NIVATOON Pro VIP',
                subtitle: 'ปลดล็อกระดับสูงสุดสำหรับแฟนพันธุ์แท้',
                priceLabel: '300 เหรียญ / เดือน',
                isCurrent: user.plan == 'vip',
                accent: const Color(0xFFD97706),
                perks: const <String>[
                  'รับโบนัส +35 ตั๋วฟรีทันทีที่สมัคร',
                  'เข้าถึงตอนล่วงหน้า & Gemini AI เต็มรูปแบบ',
                  'ยศ VIP Badge หน้าโปรไฟล์และคอมเมนต์',
                ],
                onSelect: user.plan == 'vip'
                    ? null
                    : () {
                        final res = repo.upgradePlan(
                          planId: 'vip',
                          coinCost: 300,
                          bonusTickets: 35,
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(res.message)),
                        );
                      },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.title,
    required this.subtitle,
    required this.priceLabel,
    required this.isCurrent,
    required this.accent,
    required this.perks,
    required this.onSelect,
  });

  final String title;
  final String subtitle;
  final String priceLabel;
  final bool isCurrent;
  final Color accent;
  final List<String> perks;
  final VoidCallback? onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: isCurrent ? accent : Colors.black12,
          width: isCurrent ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          color: accent,
                        ),
                      ),
                      Text(subtitle, style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                ),
                Chip(
                  label: Text(
                    priceLabel,
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...perks.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.check_circle_rounded, size: 16, color: accent),
                    const SizedBox(width: 6),
                    Expanded(child: Text(p, style: const TextStyle(fontSize: 12))),
                  ],
                ),
              ),
            ),
            if (onSelect != null) ...<Widget>[
              const SizedBox(height: 10),
              FilledButton(
                onPressed: onSelect,
                style: FilledButton.styleFrom(backgroundColor: accent),
                child: const Text(
                  'อัปเกรดด้วยเหรียญ',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ] else if (isCurrent) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                '✓ แพ็กเกจที่คุณกำลังใช้งานอยู่',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w900, color: accent, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
