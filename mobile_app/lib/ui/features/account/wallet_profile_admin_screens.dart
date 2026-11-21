import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/data/services/promptpay_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';
import 'package:nivatoon_mobile/ui/core/nivatoon_widgets.dart';

/// Coin Store & NIVATOON PLUS Subscription Screen (#3, #5, #6).
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: repo,
      builder: (BuildContext context, _) {
        final user = repo.currentUser!;
        return Scaffold(
          appBar: AppBar(
            title: const Text(
              'ร้านค้าเหรียญ & แพ็กเกจ',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          const Text(
                            'เหรียญคงเหลือ',
                            style: TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: <Widget>[
                              const CoinBadgeIcon(size: 26),
                              const SizedBox(width: 8),
                              Text(
                                '${user.coinBalance}',
                                style: const TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: <Widget>[
                          const Text(
                            'ตั๋วอ่านฟรี',
                            style: TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: <Widget>[
                              const TicketBadgeIcon(size: 22),
                              const SizedBox(width: 6),
                              Text(
                                '${user.freePassTickets} ใบ',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF008F42),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // NIVATOON PLUS ฿129 Subscription Card (#3)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF00DC64), width: 2),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'NIVATOON PLUS • ฿129 / เดือน',
                      style: TextStyle(
                        color: Color(0xFF008F42),
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      '✓ รับโบนัส +300 เหรียญทันทีหลังตรวจสลิป\n✓ ปลดล็อกอ่านตอนล่วงหน้าฟรีทุกเรื่อง',
                      style: TextStyle(fontSize: 12, height: 1.5),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: user.plan == 'plus'
                            ? null
                            : () => showRealPaymentSheet(
                                  context,
                                  repo: repo,
                                  package: PromptPayService.plusPackage,
                                ),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF00DC64),
                        ),
                        child: Text(
                          user.plan == 'plus'
                              ? 'คุณเป็นสมาชิก NIVATOON PLUS แล้ว ✓'
                              : 'สมัครแพ็กเกจ (ชำระเงินจริง ฿129)',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text(
                'แพ็กเกจเติมเหรียญ (พร้อมเพย์ 1709700341765 / ทรูมันนี่ 0997353282 • ธีรชาติ เครือวัลย์)',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
              ),
              const SizedBox(height: 8),
              ...PromptPayService.coinPackages.map(
                (pkg) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const CoinBadgeIcon(size: 30),
                    title: Text(
                      '${pkg.coins}${pkg.bonusCoins > 0 ? "+${pkg.bonusCoins}" : ""} เหรียญ',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text('รับรวม ${pkg.totalCoins} พอยน์เข้าบัญชี'),
                    trailing: FilledButton.tonal(
                      onPressed: () => showRealPaymentSheet(
                        context,
                        repo: repo,
                        package: pkg,
                      ),
                      child: Text(
                        'THB ${pkg.priceTHB}.00',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                ),
              ),
              if (user.transactions.isNotEmpty) ...<Widget>[
                const SizedBox(height: 16),
                const Text(
                  'ประวัติการชำระเงินและรับตั๋วล่าสุด',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                ),
                const SizedBox(height: 8),
                ...user.transactions.map(
                  (tx) => ListTile(
                    dense: true,
                    title: Text(
                      tx.title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text('${tx.reference} • ${tx.createdAt}'),
                    trailing: Text(
                      tx.coins > 0 ? '+${tx.coins} เหรียญ' : 'ตั๋วอ่านฟรี',
                      style: const TextStyle(
                        color: Color(0xFF00A84B),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Profile, Purchased Library, Reading History, Creator Request, Support & Settings (#4, #6, #7, #8, #10, #11, #12, #14).
class ProfileHubView extends StatefulWidget {
  const ProfileHubView({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  State<ProfileHubView> createState() => _ProfileHubViewState();
}

class _ProfileHubViewState extends State<ProfileHubView> {
  String _subTab = 'profile'; // profile | purchased | history | support | settings

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _bioCtrl = TextEditingController();
  final String _frame = 'emerald';

  // Change password & PIN controllers
  final TextEditingController _oldPassCtrl = TextEditingController();
  final TextEditingController _newPassCtrl = TextEditingController();
  final TextEditingController _oldPinCtrl = TextEditingController();
  final TextEditingController _newPinCtrl = TextEditingController();

  // Support issue controllers
  final TextEditingController _issueSubjCtrl = TextEditingController();
  final TextEditingController _issueDescCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bioCtrl.dispose();
    _oldPassCtrl.dispose();
    _newPassCtrl.dispose();
    _oldPinCtrl.dispose();
    _newPinCtrl.dispose();
    _issueSubjCtrl.dispose();
    _issueDescCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final user = widget.repo.currentUser;
    if (user == null) return;
    final picked = await FilePicker.pickFile(type: FileType.image);
    if (picked?.path != null) {
      widget.repo.updateProfile(
        displayName: user.displayName,
        bio: user.bio,
        avatarFrame: user.avatarFrame,
        avatarFilePath: picked!.path,
      );
    }
  }

  Future<void> _showCreatorSampleDialog() async {
    final penCtrl = TextEditingController();
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
                'ส่ง 1 ผลงานตัวอย่างให้แอดมินตรวจ',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    TextField(
                      controller: penCtrl,
                      decoration: const InputDecoration(labelText: 'นามปากกา'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: titleCtrl,
                      decoration:
                          const InputDecoration(labelText: 'ชื่อเรื่องผลงานตัวอย่าง (1 เรื่อง)'),
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
                        coverPath.isEmpty
                            ? '1. อัปโหลดภาพปกผลงานตัวอย่าง'
                            : 'เลือกภาพปกแล้ว ✓',
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
                      icon: const Icon(Icons.collections_bookmark_outlined),
                      label: Text(
                        pagePaths.isEmpty
                            ? '2. อัปโหลดหน้าการ์ตูนตัวอย่าง'
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
                    final res = widget.repo.submitCreatorSampleRequest(
                      penName: penCtrl.text,
                      sampleTitle: titleCtrl.text,
                      synopsis: synCtrl.text,
                      coverPath: coverPath,
                      pagePaths: pagePaths,
                    );
                    Navigator.of(dCtx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(res.message)),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF00DC64),
                  ),
                  child: const Text('ส่งให้แอดมินตรวจ'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.repo.currentUser!;
    if (_nameCtrl.text.isEmpty) _nameCtrl.text = user.displayName;
    if (_bioCtrl.text.isEmpty) _bioCtrl.text = user.bio;

    return ListView(
      padding: const EdgeInsets.all(14),
      children: <Widget>[
        // Profile Header Card (NO streak badge! Shows Coins + Free Tickets)
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    GestureDetector(
                      onTap: _pickAvatar,
                      child: Stack(
                        children: <Widget>[
                          CircleAvatar(
                            radius: 32,
                            backgroundColor: const Color(0xFF18181B),
                            child: user.avatarPath != null
                                ? ClipOval(
                                    child: AdaptiveComicImage(
                                      path: user.avatarPath!,
                                      width: 64,
                                      height: 64,
                                    ),
                                  )
                                : Text(
                                    user.displayName[0].toUpperCase(),
                                    style: const TextStyle(
                                      color: Color(0xFF00DC64),
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Color(0xFF00DC64),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.camera_alt_rounded,
                                size: 13,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            user.displayName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            '${user.email} • ยศ ${user.role.name.toUpperCase()}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.black54,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 10,
                            children: <Widget>[
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  const CoinBadgeIcon(size: 16),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${user.coinBalance} เหรียญ',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  const TicketBadgeIcon(size: 16),
                                  const SizedBox(width: 4),
                                  Text(
                                    'ตั๋วอ่านฟรี ${user.freePassTickets} ใบ',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      color: Color(0xFF008F42),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    if (user.role == UserRole.user)
                      FilledButton.tonalIcon(
                        onPressed: user.creatorStatus == CreatorStatus.pending
                            ? null
                            : _showCreatorSampleDialog,
                        icon: const Icon(Icons.upload_file_rounded, size: 16),
                        label: Text(
                          user.creatorStatus == CreatorStatus.pending
                              ? '⏳ รอแอดมินตรวจผลงานตัวอย่าง'
                              : 'ส่ง 1 ผลงานขอสิทธิ์ Creator',
                        ),
                      ),
                    OutlinedButton.icon(
                      onPressed: widget.repo.lockPinGate,
                      icon: const Icon(Icons.lock_outline_rounded, size: 16),
                      label: const Text('ล็อก PIN'),
                    ),
                    OutlinedButton.icon(
                      onPressed: widget.repo.logout,
                      icon: const Icon(Icons.logout_rounded, size: 16),
                      label: const Text('ออกจากระบบ'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // 7-Day Check-In Grid (4+3 Responsive layout, Day 1-6 +1, Day 7 +3)
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    const Text(
                      'เช็กอินรับตั๋วอ่านฟรี 7 วัน',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                    ),
                    FilledButton(
                      onPressed: () {
                        final res = widget.repo.claimDailyCheckin();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(res.message)),
                        );
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF00DC64),
                      ),
                      child: const Text(
                        'กดเช็กอินวันนี้',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: List<Widget>.generate(7, (int i) {
                    final day = i + 1;
                    final done = day <= user.checkinDay;
                    final bonus = day == 7 ? 3 : 1;
                    return Container(
                      width: 76,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: done
                            ? const Color(0xFFDCFCE7)
                            : const Color(0xFFF4F4F5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: done
                              ? const Color(0xFF00DC64)
                              : Colors.black12,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Column(
                        children: <Widget>[
                          Text(
                            'วันที่ $day',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '+$bonus ตั๋ว',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: done
                                  ? const Color(0xFF008F42)
                                  : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Sub-Tabs: แต่งโปรไฟล์ | ตอนที่ซื้อแล้ว | ประวัติการอ่าน | แจ้งปัญหา | ตั้งค่า & PIN
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: <MapEntry<String, String>>[
              const MapEntry<String, String>('profile', 'แต่งโปรไฟล์'),
              MapEntry<String, String>(
                'purchased',
                'ตอนที่ซื้อแล้ว (${user.unlockedChapters.length})',
              ),
              MapEntry<String, String>(
                'history',
                'ประวัติการอ่าน (${user.readingHistory.length})',
              ),
              const MapEntry<String, String>('support', 'แจ้งปัญหา'),
              const MapEntry<String, String>('settings', 'ตั้งค่า & PIN'),
            ].map((e) {
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(e.value),
                  selected: _subTab == e.key,
                  onSelected: (_) => setState(() => _subTab = e.key),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),

        if (_subTab == 'profile')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Text(
                    'แต่งโปรไฟล์ & อัปโหลดรูปของคุณเอง (#7)',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _pickAvatar,
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('เลือกรูปโปรไฟล์จากแกลเลอรีมือถือ'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'ชื่อที่แสดง',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _bioCtrl,
                    decoration: const InputDecoration(
                      labelText: 'คำแนะนำตัว (Bio)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: () {
                      widget.repo.updateProfile(
                        displayName: _nameCtrl.text,
                        bio: _bioCtrl.text,
                        avatarFrame: _frame,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('บันทึกโปรไฟล์เรียบร้อยแล้ว ✓')),
                      );
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF00DC64),
                    ),
                    child: const Text('บันทึกการแต่งโปรไฟล์'),
                  ),
                ],
              ),
            ),
          )
        else if (_subTab == 'purchased')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: user.unlockedChapters.isEmpty
                  ? const Text('ยังไม่มีตอนที่ซื้อหรือปลดล็อกไว้ในคลัง')
                  : Column(
                      children: user.unlockedChapters
                          .map(
                            (ch) => ListTile(
                              title: Text(
                                '${ch.seriesTitle} • ตอนที่ ${ch.chapterNumber}',
                                style: const TextStyle(fontWeight: FontWeight.w800),
                              ),
                              subtitle: Text(
                                '${ch.coinsPaid > 0 ? "ใช้ ${ch.coinsPaid} เหรียญ" : "ใช้ตั๋วอ่านฟรี"} • ${ch.unlockedAt}',
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
          )
        else if (_subTab == 'history')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: user.readingHistory.isEmpty
                  ? const Text('ยังไม่มีประวัติการอ่าน')
                  : Column(
                      children: user.readingHistory
                          .map(
                            (h) => ListTile(
                              leading: AdaptiveComicImage(
                                path: h.coverAsset,
                                width: 44,
                                height: 58,
                                borderRadius: 8,
                              ),
                              title: Text(
                                h.seriesTitle,
                                style: const TextStyle(fontWeight: FontWeight.w800),
                              ),
                              subtitle: Text(
                                'อ่านถึงตอนที่ ${h.chapterNumber} (${h.percent}%) • ${h.updatedAt}',
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
          )
        else if (_subTab == 'support')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Text(
                    'แจ้งปัญหาการใช้งานถึงแอดมิน (#14)',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _issueSubjCtrl,
                    decoration: const InputDecoration(
                      labelText: 'หัวข้อปัญหา',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _issueDescCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'รายละเอียดปัญหา',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: () {
                      if (_issueSubjCtrl.text.trim().isEmpty) return;
                      widget.repo.submitIssueReport(
                        category: 'mobile-apk',
                        subject: _issueSubjCtrl.text,
                        description: _issueDescCtrl.text,
                      );
                      _issueSubjCtrl.clear();
                      _issueDescCtrl.clear();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ส่งเรื่องแจ้งปัญหาถึงแอดมินเรียบร้อยแล้ว ✓'),
                        ),
                      );
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF00DC64),
                    ),
                    child: const Text('ส่งรายงานปัญหา'),
                  ),
                ],
              ),
            ),
          )
        else if (_subTab == 'settings')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Text(
                    'ตั้งค่าธีม ขาว/ดำ • เปลี่ยนรหัสผ่าน • เปลี่ยน PIN (#6, #8)',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                  ),
                  SwitchListTile(
                    title: const Text(
                      'โหมดมืด (Dark Theme)',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: const Text('สลับธีมขาว/ดำ และบันทึกการตั้งค่าทันที'),
                    value: user.darkMode,
                    onChanged: (bool v) => widget.repo.setDarkMode(v),
                  ),
                  const Divider(),
                  const Text(
                    'เปลี่ยนรหัสผ่านบัญชี',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _oldPassCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'รหัสผ่านปัจจุบัน',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newPassCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.tonal(
                    onPressed: () {
                      final res = widget.repo.changePassword(
                        currentPassword: _oldPassCtrl.text,
                        newPassword: _newPassCtrl.text,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res.message)),
                      );
                    },
                    child: const Text('บันทึกรหัสผ่านใหม่'),
                  ),
                  const Divider(height: 24),
                  const Text(
                    'เปลี่ยนรหัส PIN ความปลอดภัย 6 หลัก (#6)',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _oldPinCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: 'รหัส PIN ปัจจุบัน (6 หลัก)',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newPinCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: 'รหัส PIN ใหม่ (6 หลัก)',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () {
                      final res = widget.repo.changePin(
                        currentPin: _oldPinCtrl.text,
                        newPin: _newPinCtrl.text,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res.message)),
                      );
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF00DC64),
                    ),
                    child: const Text('บันทึกรหัส PIN 6 หลักใหม่'),
                  ),
                  const Divider(height: 24),
                  OutlinedButton.icon(
                    onPressed: () => widget.repo.setUseLiveWebView(true),
                    icon: const Icon(Icons.language_rounded),
                    label: const Text('สลับไปโหมดเชื่อมต่อ WebView เซิร์ฟเวอร์ (LAN/USB)'),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Admin Backoffice Screen (#4, #13, #14, #15).
class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  String _tab = 'overview'; // overview | requests | users | promos | issues | ai_smtp | logs
  final TextEditingController _promoBadgeCtrl =
      TextEditingController(text: 'PROMO');
  final TextEditingController _promoTitleCtrl = TextEditingController();
  final TextEditingController _promoMsgCtrl = TextEditingController();
  final TextEditingController _geminiKeyCtrl = TextEditingController();
  final TextEditingController _smtpUserCtrl =
      TextEditingController(text: 'nivatoonadmin@gmail.com');
  final TextEditingController _smtpPassCtrl = TextEditingController();

  @override
  void dispose() {
    _promoBadgeCtrl.dispose();
    _promoTitleCtrl.dispose();
    _promoMsgCtrl.dispose();
    _geminiKeyCtrl.dispose();
    _smtpUserCtrl.dispose();
    _smtpPassCtrl.dispose();
    super.dispose();
  }

  void _previewSampleArtwork(CreatorRequestModel req) {
    showDialog<void>(
      context: context,
      builder: (BuildContext dCtx) {
        return AlertDialog(
          title: Text(
            'ผลงานตัวอย่าง: ${req.sampleTitle}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          content: SizedBox(
            width: 360,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'ผู้ขอสิทธิ์: ${req.displayName} (${req.userEmail})\nนามปากกา: ${req.penName}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(req.synopsis, style: const TextStyle(fontSize: 12)),
                  const SizedBox(height: 10),
                  const Text(
                    'ภาพปกและหน้าตัวอย่างที่อัปโหลด:',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  AdaptiveComicImage(
                    path: req.coverAssetOrPath,
                    height: 180,
                    width: double.infinity,
                    borderRadius: 12,
                  ),
                  const SizedBox(height: 8),
                  ...req.samplePages.map(
                    (p) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AdaptiveComicImage(
                        path: p,
                        height: 220,
                        width: double.infinity,
                        borderRadius: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () {
                widget.repo.reviewCreatorRequest(req.id, false);
                Navigator.of(dCtx).pop();
              },
              child: const Text('ปฏิเสธ', style: TextStyle(color: Colors.red)),
            ),
            FilledButton(
              onPressed: () {
                widget.repo.reviewCreatorRequest(req.id, true);
                Navigator.of(dCtx).pop();
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF00DC64),
              ),
              child: const Text('✓ อนุมัติสิทธิ์ Creator'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.repo,
      builder: (BuildContext context, _) {
        return Scaffold(
          appBar: AppBar(
            title: const Text(
              'Admin Backoffice NIVATOON',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.all(14),
            children: <Widget>[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: <MapEntry<String, String>>[
                    const MapEntry<String, String>('overview', 'ภาพรวม'),
                    MapEntry<String, String>(
                      'requests',
                      'ตรวจผลงานขอสิทธิ์ (${widget.repo.creatorRequests.length})',
                    ),
                    const MapEntry<String, String>('users', 'จัดการยศ'),
                    const MapEntry<String, String>('promos', 'แจ้งเตือน & โปรโมท'),
                    MapEntry<String, String>(
                      'issues',
                      'แจ้งปัญหา (${widget.repo.issueReports.length})',
                    ),
                    const MapEntry<String, String>('ai_smtp', 'ตั้งค่า AI / Email & กฎ'),
                    MapEntry<String, String>(
                      'logs',
                      'System Logs (${widget.repo.systemLogs.length})',
                    ),
                  ].map((e) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(e.value),
                        selected: _tab == e.key,
                        onSelected: (_) => setState(() => _tab = e.key),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),

              if (_tab == 'overview') ...<Widget>[
                const Text(
                  'มังงะที่ได้รับความนิยมสูงสุด & ยอดเติมเงินสูงสุด',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
                const SizedBox(height: 8),
                ...widget.repo.seriesList.take(5).map(
                      (s) => ListTile(
                        leading: AdaptiveComicImage(
                          path: s.coverAsset,
                          width: 42,
                          height: 56,
                          borderRadius: 8,
                        ),
                        title: Text(
                          s.title,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text('${s.viewsCount} วิว • ★ ${s.rating}'),
                      ),
                    ),
              ] else if (_tab == 'requests') ...<Widget>[
                ...widget.repo.creatorRequests.map(
                  (req) => Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: AdaptiveComicImage(
                        path: req.coverAssetOrPath,
                        width: 48,
                        height: 64,
                        borderRadius: 8,
                      ),
                      title: Text(
                        '${req.sampleTitle} (${req.penName})',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      subtitle: Text('โดย ${req.userEmail} • สถานะ: ${req.status}'),
                      trailing: FilledButton.tonal(
                        onPressed: () => _previewSampleArtwork(req),
                        child: const Text('👁️ เปิดดูผลงาน'),
                      ),
                    ),
                  ),
                ),
              ] else if (_tab == 'users') ...<Widget>[
                ...widget.repo.allUsers.map(
                  (u) => Card(
                    child: ListTile(
                      title: Text(
                        u.displayName,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${u.email} • ${u.coinBalance} เหรียญ • ${u.freePassTickets} ตั๋ว',
                      ),
                      trailing: DropdownButton<UserRole>(
                        value: u.role,
                        onChanged: (UserRole? r) {
                          if (r != null) widget.repo.changeUserRole(u.id, r);
                        },
                        items: UserRole.values
                            .map(
                              (r) => DropdownMenuItem<UserRole>(
                                value: r,
                                child: Text(r.name.toUpperCase()),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                ),
              ] else if (_tab == 'promos') ...<Widget>[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        const Text(
                          'สร้างประกาศแจ้งเตือน & โปรโมชั่นใหม่ (#15)',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _promoTitleCtrl,
                          decoration: const InputDecoration(
                            labelText: 'หัวข้อโปรโมชั่น',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _promoMsgCtrl,
                          decoration: const InputDecoration(
                            labelText: 'รายละเอียด',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: () {
                            if (_promoTitleCtrl.text.trim().isEmpty) return;
                            widget.repo.createPromoNotification(
                              badge: _promoBadgeCtrl.text,
                              title: _promoTitleCtrl.text,
                              message: _promoMsgCtrl.text,
                            );
                            _promoTitleCtrl.clear();
                            _promoMsgCtrl.clear();
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF00DC64),
                          ),
                          child: const Text('เผยแพร่แจ้งเตือนทันที'),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else if (_tab == 'issues') ...<Widget>[
                if (widget.repo.issueReports.isEmpty)
                  const Text('ยังไม่มีรายการแจ้งปัญหา')
                else
                  ...widget.repo.issueReports.map(
                    (iss) => Card(
                      child: ListTile(
                        title: Text(
                          iss.subject,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text('${iss.description}\nโดย ${iss.userEmail} (${iss.status})'),
                        trailing: FilledButton.tonal(
                          onPressed: () => widget.repo.replyIssueReport(
                            issueId: iss.id,
                            status: 'resolved',
                            reply: 'ทีมแอดมินตรวจสอบและแก้ไขเรียบร้อยแล้วครับ ✓',
                          ),
                          child: const Text('✓ ปิดเคส'),
                        ),
                      ),
                    ),
                  ),
              ] else if (_tab == 'ai_smtp') ...<Widget>[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Text(
                          'ตั้งค่า Gemini AI (v1beta): ${widget.repo.geminiApiKeyMasked}',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _geminiKeyCtrl,
                          decoration: const InputDecoration(
                            labelText: 'อัปเดต Gemini API Key (v1beta)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'ตั้งค่า Gmail SMTP ส่งรหัส OTP 6 หลัก (ต้องใช้ App Password 16 หลักจาก Google 2-Step Verification)',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _smtpUserCtrl,
                          decoration: const InputDecoration(
                            labelText: 'อีเมลผู้ส่ง SMTP',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _smtpPassCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Google App Password 16 หลัก',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 10),
                        FilledButton(
                          onPressed: () {
                            widget.repo.saveAdminSettings(
                              newGeminiKey: _geminiKeyCtrl.text,
                              reasoningModel: widget.repo.geminiModelReasoning,
                              ttsModel: widget.repo.geminiModelTts,
                              imageModel: widget.repo.geminiModelImage,
                              host: widget.repo.smtpHost,
                              port: widget.repo.smtpPort,
                              userEmail: _smtpUserCtrl.text,
                              appPassword: _smtpPassCtrl.text,
                              strictSlip: true,
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('บันทึกตั้งค่า AI v1beta & SMTP แล้ว ✓'),
                              ),
                            );
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF00DC64),
                          ),
                          child: const Text('บันทึกการตั้งค่า AI & SMTP'),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else if (_tab == 'logs') ...<Widget>[
                ...widget.repo.systemLogs.map(
                  (l) => ListTile(
                    dense: true,
                    title: Text(
                      '[${l.category.toUpperCase()}] ${l.message}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                    subtitle: Text('${l.actorEmail} • ${l.createdAt}'),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
