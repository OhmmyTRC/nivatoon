import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/data/services/ai_assistant_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';
import 'package:nivatoon_mobile/ui/core/nivatoon_widgets.dart';
import 'package:nivatoon_mobile/ui/features/account/wallet_profile_admin_screens.dart';
import 'package:nivatoon_mobile/ui/features/discover/ai_discover_and_ranking_screens.dart';

/// Main 5-Tab NIVATOON Screen after Login & PIN Unlock.
class MainHomeShell extends StatefulWidget {
  const MainHomeShell({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  State<MainHomeShell> createState() => _MainHomeShellState();
}

class _MainHomeShellState extends State<MainHomeShell> {
  int _tabIndex = 0;
  String _selectedGenre = 'ทั้งหมด';
  String _selectedDay = 'ศุกร์';
  String _searchQuery = '';

  static const List<String> _genres = <String>[
    'ทั้งหมด',
    'แอ็กชัน',
    'โรแมนซ์แฟนตาซี',
    'แฟนตาซี',
    'โรแมนซ์',
    'ย้อนยุค',
  ];

  static const List<String> _days = <String>[
    'จบบริบูรณ์',
    'จันทร์',
    'อังคาร',
    'พุธ',
    'พฤหัส',
    'ศุกร์',
    'เสาร์',
    'อาทิตย์',
  ];

  void _openSeries(ComicSeries series) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SeriesDetailScreen(repo: widget.repo, series: series),
      ),
    );
  }

  void _openWallet() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => WalletScreen(repo: widget.repo),
      ),
    );
  }

  void _openAdmin() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AdminDashboardScreen(repo: widget.repo),
      ),
    );
  }

  void _openAiDiscover() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AiDiscoverScreen(
          repo: widget.repo,
          onOpenSeries: _openSeries,
        ),
      ),
    );
  }

  void _openRanking() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => RankingScreen(
          repo: widget.repo,
          onOpenSeries: _openSeries,
        ),
      ),
    );
  }

  void _openPlans() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PlansScreen(repo: widget.repo),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.repo.currentUser;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final unread = widget.repo.unreadNotificationCount;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(
          children: <Widget>[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: const Color(0xFF00DC64),
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: const Text(
                'N',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'NIVATOON',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
          ],
        ),
        actions: <Widget>[
          if (user.role == UserRole.admin)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: ActionChip(
                backgroundColor: const Color(0xFF18181B),
                label: const Text(
                  'Admin',
                  style: TextStyle(
                    color: Color(0xFF00DC64),
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
                onPressed: _openAdmin,
              ),
            ),
          IconButton(
            tooltip: 'การแจ้งเตือนและโปรโมชั่น',
            onPressed: () => showNotificationsDialog(context, widget.repo),
            icon: Stack(
              clipBehavior: Clip.none,
              children: <Widget>[
                const Icon(Icons.notifications_none_rounded),
                if (unread > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFFE11D48),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$unread',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: () => setState(() => _tabIndex = 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Row(
                children: <Widget>[
                  const TicketBadgeIcon(size: 16),
                  const SizedBox(width: 4),
                  Text(
                    '${user.freePassTickets}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF006E33),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: _openWallet,
            child: Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Row(
                children: <Widget>[
                  const CoinBadgeIcon(size: 16),
                  const SizedBox(width: 4),
                  Text(
                    '${user.coinBalance}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF78350F),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: <Widget>[
          _buildHomeTab(user),
          _buildScheduleTab(),
          _buildSearchTab(),
          _buildCanvasTab(user),
          ProfileHubView(repo: widget.repo),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (int i) => setState(() => _tabIndex = i),
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded, color: Color(0xFF00DC64)),
            label: 'หน้าหลัก',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_today_rounded, color: Color(0xFF00DC64)),
            label: 'ประจำวัน',
          ),
          NavigationDestination(
            icon: Icon(Icons.search_rounded),
            selectedIcon: Icon(Icons.search_rounded, color: Color(0xFF00DC64)),
            label: 'ค้นหา',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded, color: Color(0xFF00DC64)),
            label: 'CANVAS',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded, color: Color(0xFF00DC64)),
            label: 'โปรไฟล์',
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab(AppUser user) {
    if (widget.repo.seriesList.isEmpty) {
      return const Center(child: Text('ยังไม่มีเว็บตูนในคลัง'));
    }
    final hero = widget.repo.seriesList.first;
    final filtered = _selectedGenre == 'ทั้งหมด'
        ? widget.repo.seriesList
        : widget.repo.seriesList
            .where((s) => s.genreThai == _selectedGenre)
            .toList();
    final nextDay = (user.checkinDay % 7) + 1;
    final nextReward = nextDay == 7 ? 3 : 1;

    return ListView(
      padding: const EdgeInsets.all(14),
      children: <Widget>[
        // GitHub File Storage & Firebase Database Cloud Status Bar
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF18181B),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: <Widget>[
              const Icon(
                Icons.cloud_done_rounded,
                color: Color(0xFF00DC64),
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'GitHub Storage (OhmmyTRC/nivatoon) • ${widget.repo.seriesList.length} เรื่อง (${widget.repo.totalGitHubPagesCount} หน้า)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      'Firebase DB (niva-421c2) • ซิงก์ล่าสุด: ${widget.repo.lastCloudSyncAt}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: widget.repo.isSyncingCloud
                    ? null
                    : () async {
                        final messenger = ScaffoldMessenger.of(context);
                        final res =
                            await widget.repo.syncWithGitHubAndFirebase();
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(content: Text(res.message)),
                        );
                      },
                icon: const Icon(
                  Icons.sync_rounded,
                  size: 15,
                  color: Color(0xFF00DC64),
                ),
                label: Text(
                  widget.repo.isSyncingCloud ? 'ซิงก์...' : 'ซิงก์',
                  style: const TextStyle(
                    color: Color(0xFF00DC64),
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Hero Banner
        GestureDetector(
          onTap: () => _openSeries(hero),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: <Widget>[
                AdaptiveComicImage(
                  path: hero.coverAsset,
                  height: 210,
                  width: double.infinity,
                ),
                Container(
                  height: 210,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: <Color>[Color(0xE6000000), Color(0x33000000)],
                      begin: Alignment.bottomLeft,
                      end: Alignment.topRight,
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00DC64),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'แนะนำประจำสัปดาห์',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        hero.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        hero.synopsis,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Quick Feature Row: AI Discover / Ranking / Plans
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: <Widget>[
              ActionChip(
                avatar: const Icon(Icons.auto_awesome_rounded, size: 16, color: Color(0xFF00A84B)),
                label: const Text('AI ค้นหาเรื่องที่ใช่', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                onPressed: _openAiDiscover,
              ),
              const SizedBox(width: 8),
              ActionChip(
                avatar: const Icon(Icons.leaderboard_rounded, size: 16, color: Color(0xFFD97706)),
                label: const Text('อันดับยอดนิยม', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                onPressed: _openRanking,
              ),
              const SizedBox(width: 8),
              ActionChip(
                avatar: const Icon(Icons.workspace_premium_rounded, size: 16, color: Color(0xFF7C3AED)),
                label: const Text('แพ็กเกจ Plus/VIP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                onPressed: _openPlans,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 7-Day Free Ticket Check-In Card (#11, #12)
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: <Color>[Color(0xFF00DC64), Color(0xFF69F0AE)],
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: <Widget>[
              const TicketBadgeIcon(size: 36),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'เช็กอินรับตั๋วอ่านฟรี 7 วัน',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                        color: Colors.black,
                      ),
                    ),
                    Text(
                      'วันที่ 1–6 รับ +1 ตั๋ว • วันที่ 7 รับ +3 ตั๋ว (สะสม ${user.checkinDay}/7)',
                      style: const TextStyle(fontSize: 11, color: Colors.black87),
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: () {
                  final res = widget.repo.claimDailyCheckin();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res.message)),
                  );
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF18181B),
                ),
                child: Text(
                  'รับ +$nextReward ตั๋ว',
                  style: const TextStyle(
                    color: Color(0xFF00DC64),
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Genre Filter Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _genres.map((g) {
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(g),
                  selected: _selectedGenre == g,
                  onSelected: (_) => setState(() => _selectedGenre = g),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),

        // Comic Grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: filtered.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.66,
          ),
          itemBuilder: (_, int i) {
            final item = filtered[i];
            return _ComicCardTile(
              series: item,
              onTap: () => _openSeries(item),
            );
          },
        ),
      ],
    );
  }

  Widget _buildScheduleTab() {
    final list = _selectedDay == 'จบบริบูรณ์'
        ? widget.repo.seriesList.where((s) => s.updateDay == 'จบบริบูรณ์').toList()
        : widget.repo.seriesList
            .where((s) => s.updateDay.contains(_selectedDay))
            .toList();
    final display = list.isEmpty ? widget.repo.seriesList : list;

    return ListView(
      padding: const EdgeInsets.all(14),
      children: <Widget>[
        const Text(
          'ตารางอัปเดตประจำวัน',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _days.map((d) {
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(d),
                  selected: _selectedDay == d,
                  onSelected: (_) => setState(() => _selectedDay = d),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: display.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.66,
          ),
          itemBuilder: (_, int i) => _ComicCardTile(
            series: display[i],
            onTap: () => _openSeries(display[i]),
          ),
        ),
      ],
    );
  }

  Widget _buildSearchTab() {
    final q = _searchQuery.trim().toLowerCase();
    final results = widget.repo.seriesList.where((s) {
      if (q.isEmpty) return true;
      return s.title.toLowerCase().contains(q) ||
          s.author.toLowerCase().contains(q) ||
          s.genreThai.toLowerCase().contains(q);
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(14),
      children: <Widget>[
        TextField(
          onChanged: (String v) => setState(() => _searchQuery = v),
          decoration: InputDecoration(
            hintText: 'ค้นหาชื่อเรื่อง, ครีเอเตอร์, หมวดหมู่...',
            prefixIcon: const Icon(Icons.search_rounded),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'ผลการค้นหา (${results.length} เรื่อง)',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
        ),
        const SizedBox(height: 10),
        ...results.map(
          (s) => ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 4),
            leading: AdaptiveComicImage(
              path: s.coverAsset,
              width: 52,
              height: 70,
              borderRadius: 10,
            ),
            title: Text(
              s.title,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            ),
            subtitle: Text('${s.genreThai} • ${s.author} • ★ ${s.rating}'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => _openSeries(s),
          ),
        ),
      ],
    );
  }

  Widget _buildCanvasTab(AppUser user) {
    final canUpload =
        user.role == UserRole.creator || user.role == UserRole.admin;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF18181B),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Text(
                'NIVATOON CANVAS',
                style: TextStyle(
                  color: Color(0xFF00DC64),
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'พื้นที่ปล่อยผลงานสำหรับครีเอเตอร์',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  FilledButton.icon(
                    onPressed: () {
                      if (canUpload) {
                        _showCreatorUploadDialog();
                      } else {
                        setState(() => _tabIndex = 4);
                      }
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF00DC64),
                    ),
                    icon: Icon(canUpload ? Icons.upload_rounded : Icons.verified_user_outlined),
                    label: Text(
                      canUpload
                          ? '+ อัปโหลดเรื่องใหม่ขึ้น CANVAS'
                          : 'ขอสิทธิ์ลงผลงานในหน้าโปรไฟล์ (แนบ 1 ผลงานตัวอย่าง)',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                  if (canUpload && widget.repo.seriesList.isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: _showAddEpisodeDialog,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFB9FF66),
                        side: const BorderSide(color: Color(0xFF00DC64)),
                      ),
                      icon: const Icon(Icons.playlist_add_rounded),
                      label: const Text(
                        '+ เพิ่มตอนใหม่ในเรื่องเดิม',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: widget.repo.seriesList.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.66,
          ),
          itemBuilder: (_, int i) => _ComicCardTile(
            series: widget.repo.seriesList[i],
            onTap: () => _openSeries(widget.repo.seriesList[i]),
          ),
        ),
      ],
    );
  }

  Future<void> _showCreatorUploadDialog() async {
    final titleCtrl = TextEditingController();
    final synCtrl = TextEditingController();
    String coverPath = '';
    List<String> pagePaths = <String>[];

    await showDialog<void>(
      context: context,
      builder: (BuildContext dCtx) {
        return StatefulBuilder(
          builder: (BuildContext ctx, void Function(void Function()) setModal) {
            return AlertDialog(
              title: const Text(
                'Creator Studio: อัปโหลดเรื่องใหม่',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(labelText: 'ชื่อเรื่อง'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: synCtrl,
                      decoration: const InputDecoration(labelText: 'เรื่องย่อ'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final f = await FilePicker.pickFile(type: FileType.image);
                        if (f?.path != null) {
                          setModal(() => coverPath = f!.path!);
                        }
                      },
                      icon: const Icon(Icons.image_outlined),
                      label: Text(
                        coverPath.isEmpty ? 'เลือกรูปปกเรื่อง' : 'เลือกปกแล้ว ✓',
                      ),
                    ),
                    const SizedBox(height: 6),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final files =
                            await FilePicker.pickFiles(type: FileType.image);
                        final paths = files
                            .map((e) => e.path)
                            .whereType<String>()
                            .toList();
                        if (paths.isNotEmpty) {
                          setModal(() => pagePaths = paths);
                        }
                      },
                      icon: const Icon(Icons.collections_outlined),
                      label: Text(
                        pagePaths.isEmpty
                            ? 'เลือกหน้าการ์ตูน (หลายหน้า)'
                            : 'เลือกแล้ว ${pagePaths.length} หน้า ✓',
                      ),
                    ),
                  ],
                ),
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.of(dCtx).pop(),
                  child: const Text('ยกเลิก'),
                ),
                FilledButton(
                  onPressed: () {
                    if (titleCtrl.text.trim().isEmpty) return;
                    widget.repo.publishNewComicFromStudio(
                      title: titleCtrl.text,
                      genreThai: 'แอ็กชัน',
                      synopsis: synCtrl.text,
                      coverPath: coverPath,
                      pagePaths: pagePaths,
                      coinPrice: 0,
                    );
                    Navigator.of(dCtx).pop();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF00DC64),
                  ),
                  child: const Text('เผยแพร่ทันที'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAddEpisodeDialog() async {
    final seriesList = widget.repo.seriesList;
    if (seriesList.isEmpty) return;
    String selectedSlug = seriesList.first.slug;
    final epTitleCtrl = TextEditingController();
    final priceCtrl = TextEditingController(text: '0');
    List<String> pagePaths = <String>[];

    await showDialog<void>(
      context: context,
      builder: (BuildContext dCtx) {
        return StatefulBuilder(
          builder: (BuildContext ctx, void Function(void Function()) setModal) {
            return AlertDialog(
              title: const Text(
                'Creator Studio: เพิ่มตอนใหม่',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    DropdownButtonFormField<String>(
                      initialValue: selectedSlug,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'เลือกเรื่อง',
                        border: OutlineInputBorder(),
                      ),
                      items: seriesList
                          .map(
                            (s) => DropdownMenuItem<String>(
                              value: s.slug,
                              child: Text(
                                s.title,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setModal(() => selectedSlug = v);
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: epTitleCtrl,
                      decoration: const InputDecoration(
                        labelText: 'ชื่อตอน (เช่น จุดเริ่มต้นบทใหม่)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: priceCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'ราคาเหรียญ (0 = อ่านฟรี)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final files =
                            await FilePicker.pickFiles(type: FileType.image);
                        final paths = files
                            .map((e) => e.path)
                            .whereType<String>()
                            .toList();
                        if (paths.isNotEmpty) {
                          setModal(() => pagePaths = paths);
                        }
                      },
                      icon: const Icon(Icons.photo_library_outlined),
                      label: Text(
                        pagePaths.isEmpty
                            ? 'เลือกภาพหน้าตอน (หลายไฟล์)'
                            : 'เลือกแล้ว ${pagePaths.length} หน้า',
                      ),
                    ),
                  ],
                ),
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.of(dCtx).pop(),
                  child: const Text('ยกเลิก'),
                ),
                FilledButton(
                  onPressed: () {
                    final coin = int.tryParse(priceCtrl.text.trim()) ?? 0;
                    final res = widget.repo.addEpisodeToSeries(
                      seriesSlug: selectedSlug,
                      episodeTitle: epTitleCtrl.text,
                      pagePaths: pagePaths,
                      coinPrice: coin,
                    );
                    Navigator.of(dCtx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(res.message)),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF00DC64),
                  ),
                  child: const Text('เพิ่มตอน'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ComicCardTile extends StatelessWidget {
  const _ComicCardTile({required this.series, required this.onTap});

  final ComicSeries series;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: AdaptiveComicImage(
              path: series.coverAsset,
              width: double.infinity,
              borderRadius: 14,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            series.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
          ),
          Text(
            '${series.genreThai} • ★ ${series.rating}',
            style: const TextStyle(fontSize: 11, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

/// Series Detail Screen with Free Ticket / Coin episode unlocking.
class SeriesDetailScreen extends StatelessWidget {
  const SeriesDetailScreen({
    super.key,
    required this.repo,
    required this.series,
  });

  final NivatoonRepository repo;
  final ComicSeries series;

  void _openEpisode(
    BuildContext context,
    ComicEpisode ep, {
    required bool useTicket,
  }) {
    final res = repo.unlockEpisode(
      series: series,
      episode: ep,
      useTicket: useTicket,
    );
    if (!res.ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message)),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ComicReaderScreen(
          repo: repo,
          series: series,
          episode: ep,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: repo,
      builder: (BuildContext context, _) {
        final user = repo.currentUser;
        final inLib = user?.librarySlugs.contains(series.slug) ?? false;

        return Scaffold(
          appBar: AppBar(
            title: Text(
              series.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            actions: <Widget>[
              TextButton.icon(
                onPressed: () => repo.toggleLibrary(series.slug),
                icon: Icon(
                  inLib ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                  color: const Color(0xFF00DC64),
                ),
                label: Text(inLib ? 'ติดตามแล้ว' : '+ ติดตาม'),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  AdaptiveComicImage(
                    path: series.coverAsset,
                    width: 115,
                    height: 155,
                    borderRadius: 14,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          series.genreThai,
                          style: const TextStyle(
                            color: Color(0xFF00A84B),
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          series.title,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          'โดย ${series.author} • ★ ${series.rating}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          series.synopsis,
                          style: const TextStyle(fontSize: 12, height: 1.45),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final recap = await const AiAssistantService()
                                .recapSeriesOrEpisode(
                              series,
                              apiKey: repo.geminiRawApiKey,
                              model: repo.geminiModelReasoning,
                            );
                            if (!context.mounted) return;
                            await showDialog<void>(
                              context: context,
                              builder: (BuildContext ctx) => AlertDialog(
                                title: const Text(
                                  '✨ AI สรุปเนื้อเรื่อง',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                                content: Text(recap, style: const TextStyle(fontSize: 13, height: 1.5)),
                                actions: <Widget>[
                                  TextButton(
                                    onPressed: () => Navigator.of(ctx).pop(),
                                    child: const Text('ปิด'),
                                  ),
                                ],
                              ),
                            );
                          },
                          icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                          label: const Text(
                            'AI สรุปเนื้อเรื่อง',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                'รายการตอนทั้งหมด (${series.episodes.length} ตอน)',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              ...series.episodes.map((ep) {
                final unlocked = repo.isEpisodeUnlocked(ep);
                final thumb = ep.pageAssets.isNotEmpty
                    ? ep.pageAssets.first
                    : series.coverAsset;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: AdaptiveComicImage(
                      path: thumb,
                      width: 56,
                      height: 44,
                      borderRadius: 8,
                    ),
                    title: Text(
                      'Ep.${ep.number} — ${ep.title}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    subtitle: Text(ep.publishedAt),
                    trailing: unlocked
                        ? OutlinedButton(
                            onPressed: () =>
                                _openEpisode(context, ep, useTicket: false),
                            child: const Text('อ่าน'),
                          )
                        : Wrap(
                            spacing: 6,
                            children: <Widget>[
                              if ((user?.freePassTickets ?? 0) > 0)
                                OutlinedButton.icon(
                                  onPressed: () =>
                                      _openEpisode(context, ep, useTicket: true),
                                  icon: const TicketBadgeIcon(size: 14),
                                  label: const Text(
                                    'ใช้ตั๋วฟรี',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                ),
                              FilledButton.icon(
                                onPressed: () =>
                                    _openEpisode(context, ep, useTicket: false),
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF18181B),
                                ),
                                icon: const CoinBadgeIcon(size: 14),
                                label: Text(
                                  '${ep.coinPrice}',
                                  style: const TextStyle(
                                    color: Color(0xFFFFE066),
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}

/// Vertical Webtoon Reader with Gemini v1beta AI Panel Translation & Comments.
class ComicReaderScreen extends StatefulWidget {
  const ComicReaderScreen({
    super.key,
    required this.repo,
    required this.series,
    required this.episode,
  });

  final NivatoonRepository repo;
  final ComicSeries series;
  final ComicEpisode episode;

  @override
  State<ComicReaderScreen> createState() => _ComicReaderScreenState();
}

class _ComicReaderScreenState extends State<ComicReaderScreen> {
  final AiAssistantService _ai = const AiAssistantService();
  final ScrollController _scrollCtrl = ScrollController();
  final TextEditingController _commentCtrl = TextEditingController();

  bool _showAiOverlay = false;
  bool _loadingAi = false;
  double _readProgress = 0.0;
  final Map<int, String> _translatedPages = <int, String>{};

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final max = _scrollCtrl.position.maxScrollExtent;
    if (max <= 0) return;
    final next = (_scrollCtrl.offset / max).clamp(0.0, 1.0);
    if ((next - _readProgress).abs() >= 0.03) {
      setState(() => _readProgress = next);
    }
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggleAiTranslate() async {
    if (_showAiOverlay) {
      setState(() => _showAiOverlay = false);
      return;
    }
    setState(() {
      _showAiOverlay = true;
      _loadingAi = true;
    });
    for (int i = 0; i < widget.episode.pageAssets.length && i < 6; i++) {
      if (_translatedPages.containsKey(i)) continue;
      final txt = await _ai.translatePanel(
        widget.series,
        widget.episode,
        i,
        apiKey: widget.repo.geminiRawApiKey,
        model: widget.repo.geminiModelReasoning,
      );
      _translatedPages[i] = txt;
    }
    if (!mounted) return;
    setState(() => _loadingAi = false);
  }

  Future<void> _openAiRecap() async {
    final recap = await _ai.recapSeriesOrEpisode(
      widget.series,
      episode: widget.episode,
      apiKey: widget.repo.geminiRawApiKey,
      model: widget.repo.geminiModelReasoning,
    );
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text('✨ AI สรุปตอนนี้', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text(recap, style: const TextStyle(fontSize: 13, height: 1.5)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('ปิด'),
          ),
        ],
      ),
    );
  }

  Future<void> _openVoiceDrama() async {
    final script = await _ai.generateVoiceDramaScript(
      widget.series,
      widget.episode,
      apiKey: widget.repo.geminiRawApiKey,
      model: widget.repo.geminiModelTts,
    );
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              '🎙️ AI พากย์เสียง (${widget.repo.geminiModelTts})',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
            const SizedBox(height: 10),
            ...script.map(
              (line) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.record_voice_over_rounded, color: Color(0xFF00A84B)),
                  title: Text(line.speaker, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                  subtitle: Text(line.line, style: const TextStyle(fontSize: 12)),
                ),
              ),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('ปิด'),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToEpisode(ComicEpisode target) {
    final res = widget.repo.unlockEpisode(
      series: widget.series,
      episode: target,
      useTicket: false,
    );
    if (!res.ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message)),
      );
      return;
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => ComicReaderScreen(
          repo: widget.repo,
          series: widget.series,
          episode: target,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final comments = widget.repo.commentsForEpisode(
      widget.series.slug,
      widget.episode.number,
    );
    final eps = widget.series.episodes;
    final currentIdx = eps.indexWhere((e) => e.id == widget.episode.id);
    final prevEp = currentIdx > 0 ? eps[currentIdx - 1] : null;
    final nextEp = (currentIdx >= 0 && currentIdx + 1 < eps.length)
        ? eps[currentIdx + 1]
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFF0C0D0F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121418),
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              '${widget.series.title} • Ep.${widget.episode.number}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            LinearProgressIndicator(
              value: _readProgress,
              minHeight: 2,
              backgroundColor: Colors.white12,
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF00DC64)),
            ),
          ],
        ),
        actions: <Widget>[
          IconButton(
            tooltip: 'AI สรุปตอน',
            onPressed: _openAiRecap,
            icon: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF00DC64)),
          ),
          IconButton(
            tooltip: 'AI พากย์เสียง',
            onPressed: _openVoiceDrama,
            icon: const Icon(Icons.record_voice_over_rounded, color: Color(0xFFFFE066)),
          ),
          TextButton.icon(
            onPressed: _toggleAiTranslate,
            icon: const Icon(
              Icons.translate_rounded,
              color: Color(0xFFB9FF66),
              size: 18,
            ),
            label: Text(
              _showAiOverlay ? 'ซ่อน' : 'AI แปล',
              style: const TextStyle(
                color: Color(0xFFB9FF66),
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        controller: _scrollCtrl,
        children: <Widget>[
          if (_loadingAi)
            const LinearProgressIndicator(
              minHeight: 3,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFB9FF66)),
            ),
          ...widget.episode.pageAssets.asMap().entries.map((entry) {
            final idx = entry.key;
            final asset = entry.value;
            final translated = _translatedPages[idx] ??
                '✨ Gemini AI แปลหน้า ${idx + 1}: กำลังประมวลผลบทสนทนา...';
            return Stack(
              children: <Widget>[
                AdaptiveComicImage(
                  path: asset,
                  width: double.infinity,
                  fit: BoxFit.fitWidth,
                ),
                if (_showAiOverlay)
                  Positioned(
                    left: 16,
                    right: 16,
                    top: 18,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.94),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFF00DC64),
                          width: 2,
                        ),
                      ),
                      child: Text(
                        translated,
                        style: const TextStyle(
                          color: Colors.black,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          }),
          Container(
            color: const Color(0xFF101216),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: prevEp == null ? null : () => _navigateToEpisode(prevEp),
                    icon: const Icon(Icons.arrow_back_rounded),
                    label: Text(prevEp == null ? 'ตอนแรกแล้ว' : 'Ep.${prevEp.number}'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: nextEp == null ? null : () => _navigateToEpisode(nextEp),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF00DC64),
                    ),
                    icon: const Icon(Icons.arrow_forward_rounded),
                    label: Text(nextEp == null ? 'ตอนล่าสุดแล้ว' : 'ตอนถัดไป Ep.${nextEp.number}'),
                  ),
                ),
              ],
            ),
          ),
          Container(
            color: const Color(0xFF14171D),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'ความคิดเห็นนักอ่าน (${comments.length})',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: _commentCtrl,
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          hintText: 'ร่วมพูดคุยเกี่ยวกับตอนนี้...',
                          hintStyle: TextStyle(color: Colors.white54),
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        final mod = _ai.moderateComment(_commentCtrl.text);
                        if (!mod.allowed) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(mod.reason)),
                          );
                          return;
                        }
                        widget.repo.addComment(
                          widget.series.slug,
                          widget.episode.number,
                          _commentCtrl.text,
                        );
                        _commentCtrl.clear();
                        setState(() {});
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF00DC64),
                      ),
                      child: const Text('ส่ง'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...comments.map(
                  (c) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          '${c.authorName} [${c.roleBadge}] • ${c.createdAt}',
                          style: const TextStyle(
                            color: Color(0xFF00DC64),
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          c.body,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
