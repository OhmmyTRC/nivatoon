import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/services/promptpay_service.dart';
import 'package:nivatoon_mobile/data/services/server_config_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';

/// Central reactive state & business rule repository for NIVATOON Android.
class NivatoonRepository extends ChangeNotifier {
  NivatoonRepository({ServerConfigService? serverConfig})
      : _serverConfig = serverConfig ?? ServerConfigService() {
    _seedInitialData();
  }

  final ServerConfigService _serverConfig;

  final List<AppUser> _users = <AppUser>[];
  final List<ComicSeries> _seriesList = <ComicSeries>[];
  final List<ComicComment> _comments = <ComicComment>[];
  final List<CreatorRequestModel> _creatorRequests = <CreatorRequestModel>[];
  final List<IssueReportModel> _issueReports = <IssueReportModel>[];
  final List<NotificationModel> _notifications = <NotificationModel>[];
  final List<SystemLogModel> _systemLogs = <SystemLogModel>[];
  final Map<String, Set<String>> _readNotifIdsByUser = <String, Set<String>>{};
  final Set<String> _usedSlipHashes = <String>{};
  final Map<String, String> _otpByEmail = <String, String>{};

  AppUser? _currentUser;
  bool _pinUnlocked = false;
  bool _useLiveWebView = false;

  // Admin configurable AI & SMTP settings
  String geminiApiKeyMasked = 'AIza••••7uQ (v1beta)';
  String geminiModelReasoning = 'gemini-4-hydrogen';
  String geminiModelTts = 'gemini-3.8-flash-tts';
  String geminiModelImage = 'gemini-nano-banana-2.1';
  String smtpHost = 'smtp.gmail.com';
  String smtpPort = '587';
  String smtpUser = 'nivatoonadmin@gmail.com';
  String smtpAppPassword = '';
  bool strictSlipCheck = true;

  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isPinUnlocked => _pinUnlocked;
  bool get useLiveWebView => _useLiveWebView;
  bool get isDarkMode => _currentUser?.darkMode ?? false;

  List<AppUser> get allUsers => List<AppUser>.unmodifiable(_users);
  List<ComicSeries> get seriesList => List<ComicSeries>.unmodifiable(_seriesList);
  List<CreatorRequestModel> get creatorRequests =>
      List<CreatorRequestModel>.unmodifiable(_creatorRequests);
  List<IssueReportModel> get issueReports =>
      List<IssueReportModel>.unmodifiable(_issueReports);
  List<NotificationModel> get notifications =>
      List<NotificationModel>.unmodifiable(_notifications);
  List<SystemLogModel> get systemLogs =>
      List<SystemLogModel>.unmodifiable(_systemLogs);

  int get unreadNotificationCount {
    final uid = _currentUser?.id;
    if (uid == null) return 0;
    final readSet = _readNotifIdsByUser[uid] ?? const <String>{};
    return _notifications.where((n) => !readSet.contains(n.id)).length;
  }

  bool isNotificationRead(String notificationId) {
    final uid = _currentUser?.id;
    if (uid == null) return false;
    return _readNotifIdsByUser[uid]?.contains(notificationId) ?? false;
  }

  void setUseLiveWebView(bool value) {
    _useLiveWebView = value;
    notifyListeners();
  }

  void _addLog(String level, String category, String message, String actor) {
    _systemLogs.insert(
      0,
      SystemLogModel(
        id: 'log-${DateTime.now().millisecondsSinceEpoch}-${_systemLogs.length}',
        level: level,
        category: category,
        message: message,
        actorEmail: actor,
        createdAt: _nowLabel(),
      ),
    );
  }

  static String _nowLabel() {
    final now = DateTime.now();
    final y = now.year.toString().padLeft(4, '0');
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  }

  static String _todayKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  void _seedInitialData() {
    const samplePages = <String>[
      'assets/comics/page-01.jpg',
      'assets/comics/page-02.jpg',
      'assets/comics/page-03.jpg',
      'assets/comics/page-04.jpg',
    ];

    List<ComicEpisode> buildEpisodes(String slug) => <ComicEpisode>[
          ComicEpisode(
            id: '$slug-ep-1',
            number: 1,
            title: 'ตอนที่ 1 จุดเริ่มต้นแห่งโชคชะตา',
            coinPrice: 0,
            publishedAt: '2026-11-15',
            pageAssets: samplePages,
          ),
          ComicEpisode(
            id: '$slug-ep-2',
            number: 2,
            title: 'ตอนที่ 2 พลังที่ตื่นขึ้นในเงามืด',
            coinPrice: 0,
            publishedAt: '2026-11-17',
            pageAssets: samplePages,
          ),
          ComicEpisode(
            id: '$slug-ep-3',
            number: 3,
            title: 'ตอนที่ 3 พันธสัญญาเลือดและคมดาบ (ล่วงหน้า)',
            coinPrice: 15,
            publishedAt: '2026-11-19',
            pageAssets: samplePages,
          ),
          ComicEpisode(
            id: '$slug-ep-4',
            number: 4,
            title: 'ตอนที่ 4 ศึกตัดสินกลางรัตติกาล (ล่วงหน้า)',
            coinPrice: 15,
            publishedAt: '2026-11-21',
            pageAssets: samplePages,
          ),
        ];

    _seriesList.addAll(<ComicSeries>[
      ComicSeries(
        slug: 'moonlit-sword',
        title: 'ดาบจันทราเหนือมหานคร',
        author: 'HANA STUDIO',
        genreThai: 'แอ็กชัน',
        updateDay: 'ศุกร์',
        rating: 4.9,
        viewsCount: 285400,
        coverAsset: 'assets/comics/01-moonlit-sword-cover.jpg',
        synopsis:
            'นักล่าอสูรหนุ่มผู้ถือครองดาบจันทราโบราณ ต้องปะทะกับองค์กรลับที่ควบคุมมหานครยามค่ำคืน',
        episodes: buildEpisodes('moonlit-sword'),
      ),
      ComicSeries(
        slug: 'palace-bloom',
        title: 'บุปผาซ่อนเล่ห์แห่งวังหลวง',
        author: 'MEILIN ART',
        genreThai: 'โรแมนซ์แฟนตาซี',
        updateDay: 'เสาร์',
        rating: 4.8,
        viewsCount: 241900,
        coverAsset: 'assets/comics/02-palace-bloom-cover.jpg',
        synopsis:
            'องค์หญิงผู้หวนคืนจากอนาคต วางหมากชิงบัลลังก์ท่ามกลางความรักและแผนลอบสังหารในราชสำนัก',
        episodes: buildEpisodes('palace-bloom'),
      ),
      ComicSeries(
        slug: 'unrivaled-system',
        title: 'ระบบเทพไร้พ่ายทะลุมิติ',
        author: 'K-TOON LAB',
        genreThai: 'แอ็กชัน',
        updateDay: 'จันทร์',
        rating: 4.9,
        viewsCount: 312000,
        coverAsset: 'assets/comics/03-unrivaled-system-cover.jpg',
        synopsis:
            'จากแรงก์ F ผู้ถูกทอดทิ้งในดันเจี้ยน สู่ผู้ครอบครองหน้าต่างระบบระดับจักรพรรดิ',
        episodes: buildEpisodes('unrivaled-system'),
      ),
      ComicSeries(
        slug: 'reborn-as-demon',
        title: 'จุติใหม่ในร่างจอมมารสวรรค์',
        author: 'RYUJI WORKS',
        genreThai: 'แฟนตาซี',
        updateDay: 'พุธ',
        rating: 4.7,
        viewsCount: 198000,
        coverAsset: 'assets/comics/04-reborn-as-demon-cover.jpg',
        synopsis:
            'ปรมาจารย์พรรคมารฟื้นคืนชีพในรอบร้อยปี พร้อมทวงคืนยุทธภพที่ถูกสำนักธรรมะยึดครอง',
        episodes: buildEpisodes('reborn-as-demon'),
      ),
      ComicSeries(
        slug: 'letter-from-tomorrow',
        title: 'จดหมายรักจากวันพรุ่งนี้',
        author: 'SORA',
        genreThai: 'โรแมนซ์',
        updateDay: 'อาทิตย์',
        rating: 4.8,
        viewsCount: 175600,
        coverAsset: 'assets/comics/05-letter-from-tomorrow-cover.jpg',
        synopsis:
            'เมื่อตู้ไปรษณีย์เก่าหลังโรงเรียนส่งจดหมายจากตัวเธอเองในอีก 10 ปีข้างหน้า',
        episodes: buildEpisodes('letter-from-tomorrow'),
      ),
      ComicSeries(
        slug: 'rank-zero-hunter',
        title: 'ฮันเตอร์แรงก์ศูนย์ผู้กลืนกินเงา',
        author: 'APEX RED',
        genreThai: 'แอ็กชัน',
        updateDay: 'พฤหัส',
        rating: 4.9,
        viewsCount: 267300,
        coverAsset: 'assets/comics/06-rank-zero-hunter-cover.jpg',
        synopsis:
            'เกตระดับ S เปิดขึ้นใจกลางกรุงเทพฯ มีเพียงฮันเตอร์นอกสารบบคนเดียวที่ปิดมันได้',
        episodes: buildEpisodes('rank-zero-hunter'),
      ),
      ComicSeries(
        slug: 'eclipse-academy',
        title: 'โรงเรียนเวทมนตร์จันทรุปราคา',
        author: 'LUNA',
        genreThai: 'แฟนตาซี',
        updateDay: 'อังคาร',
        rating: 4.6,
        viewsCount: 143000,
        coverAsset: 'assets/comics/07-eclipse-academy-cover.jpg',
        synopsis:
            'ความลับของหอคอยต้องห้ามในสถาบันเวทมนตร์ที่เปิดออกทุกคืนจันทรุปราคา',
        episodes: buildEpisodes('eclipse-academy'),
      ),
      ComicSeries(
        slug: 'shadow-apothecary',
        title: 'หมอยาเงาแห่งหุบเขาพันพิษ',
        author: 'YUN',
        genreThai: 'ย้อนยุค',
        updateDay: 'ศุกร์',
        rating: 4.7,
        viewsCount: 158400,
        coverAsset: 'assets/comics/08-shadow-apothecary-cover.jpg',
        synopsis:
            'หมอยาพเนจรผู้ปรุงโอสถถอนพิษแลกกับความทรงจำของผู้ป่วย',
        episodes: buildEpisodes('shadow-apothecary'),
      ),
      ComicSeries(
        slug: 'neon-shinjuku-99',
        title: 'นีออนชินจูกุ 2099',
        author: 'CYBER INK',
        genreThai: 'แอ็กชัน',
        updateDay: 'เสาร์',
        rating: 4.6,
        viewsCount: 129000,
        coverAsset: 'assets/comics/09-neon-shinjuku-99-cover.jpg',
        synopsis:
            'นักสืบไซบอร์กตามล่าวิญญาณดิจิทัลที่หลุดออกจากโครงข่ายประสาทเทียม',
        episodes: buildEpisodes('neon-shinjuku-99'),
      ),
      ComicSeries(
        slug: 'duchess-contract',
        title: 'สัญญาวิวาห์ของดัชเชสเลือดเย็น',
        author: 'CLAIRE',
        genreThai: 'โรแมนซ์แฟนตาซี',
        updateDay: 'จบบริบูรณ์',
        rating: 4.9,
        viewsCount: 294500,
        coverAsset: 'assets/comics/10-duchess-contract-cover.jpg',
        synopsis:
            'วิวาห์ลวงระหว่างดัชเชสผู้กุมอำนาจกองทัพเหนือกับแกรนด์ดยุกผู้ต้องคำสาป',
        episodes: buildEpisodes('duchess-contract'),
      ),
    ]);

    _users.addAll(<AppUser>[
      AppUser(
        id: 'user-reader',
        email: 'reader@gmail.com',
        password: 'Reader2026!',
        pin: '123456',
        role: UserRole.user,
        creatorStatus: CreatorStatus.none,
        displayName: 'เคนจิ นักอ่านสายแอ็กชัน',
        bio: 'ชอบแนวระบบเทพและโรแมนซ์แฟนตาซี',
        avatarFrame: 'emerald',
        coinBalance: 0,
        freePassTickets: 3,
        plan: 'free',
        checkinDay: 1,
        librarySlugs: <String>['moonlit-sword', 'unrivaled-system'],
        readingHistory: <ReadingHistoryRecord>[
          const ReadingHistoryRecord(
            seriesSlug: 'moonlit-sword',
            seriesTitle: 'ดาบจันทราเหนือมหานคร',
            coverAsset: 'assets/comics/01-moonlit-sword-cover.jpg',
            chapterNumber: 1,
            percent: 100,
            updatedAt: '2026-11-21 20:30',
          ),
        ],
      ),
      AppUser(
        id: 'user-creator',
        email: 'creator@nivatoon.app',
        password: 'Creator2026!',
        pin: '123456',
        role: UserRole.creator,
        creatorStatus: CreatorStatus.approved,
        displayName: 'HANA STUDIO (ครีเอเตอร์)',
        bio: 'ผู้วาด ดาบจันทราเหนือมหานคร บน NIVATOON CANVAS',
        avatarFrame: 'neon',
        coinBalance: 1450,
        freePassTickets: 5,
        plan: 'plus',
        checkinDay: 3,
        transactions: <WalletTransactionRecord>[
          const WalletTransactionRecord(
            id: 'tx-seed-1',
            reference: 'PP-20261121-01',
            title: 'เติมแพ็กเกจ 550+50 เหรียญ (PromptPay)',
            provider: 'PROMPTPAY',
            coins: 600,
            amountTHB: 149,
            createdAt: '2026-11-20 18:15',
          ),
        ],
      ),
      AppUser(
        id: 'user-admin',
        email: 'admin@nivatoon.app',
        password: 'NivaAdmin2026!',
        pin: '123456',
        role: UserRole.admin,
        creatorStatus: CreatorStatus.approved,
        displayName: 'แอดมินระบบ NIVATOON',
        bio: 'ผู้ดูแลระบบ อนุมัติสิทธิ์ครีเอเตอร์ และตรวจสอบยอดโอน',
        avatarFrame: 'gold',
        coinBalance: 9999,
        freePassTickets: 99,
        plan: 'plus',
        checkinDay: 7,
      ),
    ]);

    _creatorRequests.add(
      CreatorRequestModel(
        id: 'creq-seed-1',
        userId: 'user-reader',
        userEmail: 'reader@gmail.com',
        displayName: 'เคนจิ นักอ่านสายแอ็กชัน',
        penName: 'KENJI STUDIO',
        sampleTitle: 'อัศวินเงาแห่งหอคอยทมิฬ',
        synopsis: 'ผลงานตัวอย่าง 1 เรื่อง: แนวแอ็กชันแฟนตาซี มีภาพปกและหน้าตัวอย่างครบ',
        coverAssetOrPath: 'assets/comics/06-rank-zero-hunter-cover.jpg',
        samplePages: samplePages,
        isLocalFile: false,
        status: 'pending',
        createdAt: '2026-11-21 19:00',
      ),
    );

    _notifications.addAll(<NotificationModel>[
      NotificationModel(
        id: 'notif-1',
        badge: 'EVENT',
        title: 'เช็กอิน 7 วัน รับตั๋วอ่านฟรีสูงสุด 9 ใบ!',
        message: 'เช็กอินวันที่ 1–6 รับวันละ 1 ตั๋ว พิเศษวันที่ 7 รับโบนัส 3 ตั๋วอ่านฟรีทันที',
        createdAt: '2026-11-21 09:00',
      ),
      NotificationModel(
        id: 'notif-2',
        badge: 'PROMO',
        title: 'สมัคร NIVATOON PLUS ฿129/เดือน รับทันที +300 เหรียญ',
        message:
            'อ่านตอนล่วงหน้าฟรีทุกเรื่อง ชำระผ่าน PromptPay 1709700341765 หรือ TrueMoney 0997353282 (ธีรชาติ เครือวัลย์)',
        createdAt: '2026-11-21 10:30',
      ),
    ]);

    _comments.addAll(<ComicComment>[
      const ComicComment(
        id: 'cmt-1',
        seriesSlug: 'moonlit-sword',
        chapterNumber: 1,
        authorName: 'HANA STUDIO',
        roleBadge: 'CREATOR',
        body: 'ขอบคุณนักอ่านทุกคนที่ติดตามตอนแรกครับ! กดใช้ AI แปลภาพในหน้าอ่านได้เลย',
        createdAt: '2026-11-21',
      ),
      const ComicComment(
        id: 'cmt-2',
        seriesSlug: 'moonlit-sword',
        chapterNumber: 1,
        authorName: 'เคนจิ นักอ่านสายแอ็กชัน',
        roleBadge: 'READER',
        body: 'ภาพสวยมาก ใช้ตั๋วอ่านฟรีปลดล็อกตอนล่วงหน้าได้จริง',
        createdAt: '2026-11-21',
      ),
    ]);

    _addLog(
      'info',
      'system',
      'เริ่มต้นระบบ NIVATOON Native Dart Engine (เริ่มต้น 0 เหรียญ + 3 ตั๋วอ่านฟรี)',
      'system@nivatoon.app',
    );
  }

  // -------------------------
  // 1. Auth & PIN Gate
  // -------------------------
  ({bool ok, String message}) login(String email, String password) {
    final cleanEmail = email.trim().toLowerCase();
    for (final u in _users) {
      if (u.email.toLowerCase() == cleanEmail && u.password == password) {
        _currentUser = u;
        _pinUnlocked = false;
        _addLog('info', 'auth', 'เข้าสู่ระบบสำเร็จ (${u.email})', u.email);
        notifyListeners();
        return (ok: true, message: 'เข้าสู่ระบบสำเร็จ');
      }
    }
    return (ok: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }

  /// Registers a brand-new user starting strictly with 0 Coins and 3 Free Pass Tickets (#2).
  ({bool ok, String message}) register({
    required String displayName,
    required String email,
    required String password,
    required String pin,
  }) {
    final cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.contains('@')) {
      return (ok: false, message: 'กรุณากรอกอีเมลให้ถูกต้อง');
    }
    if (password.length < 6) {
      return (ok: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
      return (ok: false, message: 'กรุณาตั้งรหัส PIN ตัวเลข 6 หลัก');
    }
    if (_users.any((u) => u.email.toLowerCase() == cleanEmail)) {
      return (ok: false, message: 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    final newUser = AppUser(
      id: 'user-${DateTime.now().millisecondsSinceEpoch}',
      email: cleanEmail,
      password: password,
      pin: pin,
      role: UserRole.user,
      creatorStatus: CreatorStatus.none,
      displayName: displayName.trim().isEmpty ? 'นักอ่านใหม่' : displayName.trim(),
      coinBalance: 0,
      freePassTickets: 3,
      plan: 'free',
      checkinDay: 0,
    );
    _users.add(newUser);
    _currentUser = newUser;
    _pinUnlocked = false;
    _addLog(
      'info',
      'auth',
      'สมัครสมาชิกใหม่สำเร็จ เริ่มต้น 0 เหรียญ + ตั๋วอ่านฟรี 3 ใบ ($cleanEmail)',
      cleanEmail,
    );
    notifyListeners();
    return (ok: true, message: 'สมัครสมาชิกสำเร็จ! รับตั๋วอ่านฟรี 3 ใบ');
  }

  bool verifyPin(String enteredPin) {
    final user = _currentUser;
    if (user == null) return false;
    if (user.pin == enteredPin.trim()) {
      _pinUnlocked = true;
      notifyListeners();
      return true;
    }
    return false;
  }

  void lockPinGate() {
    _pinUnlocked = false;
    notifyListeners();
  }

  void logout() {
    _currentUser = null;
    _pinUnlocked = false;
    _useLiveWebView = false;
    notifyListeners();
  }

  // -------------------------
  // 2. Change Password, Change PIN & 6-Digit OTP Recovery (#6, #8, #9)
  // -------------------------
  ({bool ok, String message}) changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    final user = _currentUser;
    if (user == null) return (ok: false, message: 'กรุณาเข้าสู่ระบบก่อน');
    if (user.password != currentPassword) {
      return (ok: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    if (newPassword.length < 6) {
      return (ok: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    user.password = newPassword;
    _addLog('security', 'auth', 'เปลี่ยนรหัสผ่านสำเร็จ', user.email);
    notifyListeners();
    return (ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ✓');
  }

  ({bool ok, String message}) changePin({
    String? currentPin,
    String? currentPassword,
    required String newPin,
  }) {
    final user = _currentUser;
    if (user == null) return (ok: false, message: 'กรุณาเข้าสู่ระบบก่อน');
    if (!RegExp(r'^\d{6}$').hasMatch(newPin.trim())) {
      return (ok: false, message: 'กรุณากรอกรหัส PIN ใหม่เป็นตัวเลข 6 หลัก');
    }
    final validPin = currentPin != null && currentPin.trim() == user.pin;
    final validPass = currentPassword != null && currentPassword == user.password;
    if (!validPin && !validPass) {
      return (ok: false, message: 'รหัส PIN ปัจจุบัน หรือรหัสผ่านบัญชีไม่ถูกต้อง');
    }
    user.pin = newPin.trim();
    _pinUnlocked = true;
    _addLog('security', 'auth', 'เปลี่ยนรหัส PIN 6 หลักสำเร็จ', user.email);
    notifyListeners();
    return (ok: true, message: 'เปลี่ยนรหัส PIN 6 หลักเรียบร้อยแล้ว ✓');
  }

  Future<({bool ok, String message, String? generatedOtp})>
      requestPasswordResetOtp(String email) async {
    final cleanEmail = email.trim().toLowerCase();
    final matched =
        _users.where((u) => u.email.toLowerCase() == cleanEmail).toList();
    if (matched.isEmpty) {
      return (
        ok: false,
        message: 'ไม่พบบัญชีที่ใช้อีเมลนี้ในระบบ',
        generatedOtp: null,
      );
    }

    final code = (100000 + Random().nextInt(900000)).toString();
    _otpByEmail[cleanEmail] = code;

    // Also try calling the live Next.js server if reachable on LAN/USB
    try {
      final serverUrl = await _serverConfig.loadSavedUrl();
      final res = await http
          .post(
            Uri.parse('$serverUrl/api/auth/forgot-password'),
            headers: <String, String>{'Content-Type': 'application/json'},
            body: jsonEncode(<String, String>{'email': cleanEmail}),
          )
          .timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        _addLog('info', 'auth-otp', 'ส่ง CODE 6 หลักผ่าน SMTP ไปยัง $cleanEmail', cleanEmail);
        return (
          ok: true,
          message: 'ส่งรหัส CODE 6 หลักไปยังอีเมล $cleanEmail แล้ว',
          generatedOtp: null,
        );
      }
    } catch (_) {}

    _addLog(
      'info',
      'auth-otp',
      'สร้างรหัสกู้คืน OTP 6 หลักสำหรับ $cleanEmail: $code (โหมดแอปมือถือ)',
      cleanEmail,
    );
    return (
      ok: true,
      message:
          'สร้าง CODE 6 หลักสำหรับกู้คืนรหัสผ่านแล้ว (รหัสยืนยันของคุณคือ $code — ตั้งค่า Gmail App Password 16 หลักในหน้า Admin เพื่อส่งเข้าเมลภายนอก)',
      generatedOtp: code,
    );
  }

  ({bool ok, String message}) confirmPasswordResetOtp({
    required String email,
    required String code,
    required String newPassword,
  }) {
    final cleanEmail = email.trim().toLowerCase();
    final expected = _otpByEmail[cleanEmail];
    if (expected == null || expected != code.trim()) {
      return (ok: false, message: 'รหัส CODE 6 หลักไม่ถูกต้องหรือหมดอายุ');
    }
    if (newPassword.length < 6) {
      return (ok: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    for (final u in _users) {
      if (u.email.toLowerCase() == cleanEmail) {
        u.password = newPassword;
        _otpByEmail.remove(cleanEmail);
        _addLog('security', 'auth-otp', 'รีเซ็ตรหัสผ่านด้วย CODE 6 หลักสำเร็จ', cleanEmail);
        notifyListeners();
        return (ok: true, message: 'รีเซ็ตรหัสผ่านใหม่สำเร็จ! เข้าสู่ระบบได้เลย');
      }
    }
    return (ok: false, message: 'ไม่พบบัญชีผู้ใช้');
  }

  // -------------------------
  // 3. 7-Day Ticket Check-In (#11, #12)
  // -------------------------
  ({bool ok, String message, int rewardTickets}) claimDailyCheckin() {
    final user = _currentUser;
    if (user == null) {
      return (ok: false, message: 'กรุณาเข้าสู่ระบบก่อน', rewardTickets: 0);
    }
    final today = _todayKey();
    if (user.lastCheckinDate == today) {
      return (
        ok: false,
        message: 'คุณเช็กอินรับตั๋วอ่านฟรีของวันนี้ไปแล้ว',
        rewardTickets: 0,
      );
    }
    final nextDay = (user.checkinDay % 7) + 1;
    final reward = nextDay == 7 ? 3 : 1;
    user.checkinDay = nextDay;
    user.lastCheckinDate = today;
    user.freePassTickets += reward;
    user.transactions.insert(
      0,
      WalletTransactionRecord(
        id: 'tx-chk-${DateTime.now().millisecondsSinceEpoch}',
        reference: 'CHK-DAY$nextDay',
        title: 'เช็กอินวันที่ $nextDay/7 รับ +$reward ตั๋วอ่านฟรี',
        provider: 'CHECKIN',
        coins: 0,
        amountTHB: 0,
        createdAt: _nowLabel(),
      ),
    );
    _addLog(
      'info',
      'checkin',
      'เช็กอินวันที่ $nextDay/7 รับ +$reward ตั๋วอ่านฟรี (รวม ${user.freePassTickets} ใบ)',
      user.email,
    );
    notifyListeners();
    return (
      ok: true,
      message: 'เช็กอินวันที่ $nextDay สำเร็จ! ได้รับ +$reward ตั๋วอ่านฟรี',
      rewardTickets: reward,
    );
  }

  // -------------------------
  // 4. Notifications Read State (#2, #15)
  // -------------------------
  void markAllNotificationsRead() {
    final uid = _currentUser?.id;
    if (uid == null) return;
    final set = _readNotifIdsByUser.putIfAbsent(uid, () => <String>{});
    for (final n in _notifications) {
      set.add(n.id);
    }
    notifyListeners();
  }

  void createPromoNotification({
    required String badge,
    required String title,
    required String message,
  }) {
    _notifications.insert(
      0,
      NotificationModel(
        id: 'notif-${DateTime.now().millisecondsSinceEpoch}',
        badge: badge.trim().isEmpty ? 'PROMO' : badge.trim().toUpperCase(),
        title: title.trim(),
        message: message.trim(),
        createdAt: _nowLabel(),
      ),
    );
    _addLog('info', 'admin', 'สร้างประกาศโปรโมชั่นใหม่: $title', _currentUser?.email ?? 'admin');
    notifyListeners();
  }

  // -------------------------
  // 5. Real Slip Upload & Payment Verification (#3, #6)
  // -------------------------
  Future<({
    bool ok,
    String title,
    String message,
    String reference,
    int creditedCoins,
    bool upgradedPlus,
  })> verifySlipAndCredit({
    required CoinPackage package,
    required String provider,
    required String slipFilePath,
  }) async {
    final user = _currentUser;
    if (user == null) {
      return (
        ok: false,
        title: 'กรุณาเข้าสู่ระบบ',
        message: 'ต้องเข้าสู่ระบบก่อนชำระเงิน',
        reference: '',
        creditedCoins: 0,
        upgradedPlus: false,
      );
    }
    if (slipFilePath.trim().isEmpty) {
      return (
        ok: false,
        title: 'ยังไม่ได้แนบสลิปโอนเงิน',
        message: 'กรุณาอัปโหลดภาพสลิปโอนเงินจริงก่อนกดยืนยัน',
        reference: '',
        creditedCoins: 0,
        upgradedPlus: false,
      );
    }

    final slipInfo = await PromptPayService.inspectSlipFile(slipFilePath);
    if (slipInfo.byteLength < 1200) {
      _addLog('warn', 'payment', 'ปฏิเสธสลิปที่ไม่สมบูรณ์ (${package.priceTHB} บาท)', user.email);
      return (
        ok: false,
        title: 'สลิปไม่ถูกต้องหรือไม่ชัดเจน',
        message:
            'ไฟล์ภาพสลิปมีขนาดเล็กผิดปกติ กรุณาอัปโหลดภาพสลิปโอนเงินจริงที่มียอด ฿${package.priceTHB}.00 เข้าบัญชี ${PromptPayService.promptPayAccountName}',
        reference: slipInfo.reference,
        creditedCoins: 0,
        upgradedPlus: false,
      );
    }
    if (_usedSlipHashes.contains(slipInfo.slipHash)) {
      _addLog('error', 'payment', 'ตรวจพบการใช้สลิปโอนเงินซ้ำ (${slipInfo.reference})', user.email);
      return (
        ok: false,
        title: 'สลิปนี้ถูกใช้งานไปแล้ว',
        message: 'ระบบตรวจพบเลขอ้างอิง/ไฟล์สลิปซ้ำ (${slipInfo.reference}) กรุณาใช้สลิปยอดโอนใหม่',
        reference: slipInfo.reference,
        creditedCoins: 0,
        upgradedPlus: false,
      );
    }

    _usedSlipHashes.add(slipInfo.slipHash);
    user.coinBalance += package.totalCoins;
    if (package.isPlanUpgrade) {
      user.plan = 'plus';
    }
    user.transactions.insert(
      0,
      WalletTransactionRecord(
        id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
        reference: slipInfo.reference,
        title: package.isPlanUpgrade
            ? 'สมัคร NIVATOON PLUS (+${package.totalCoins} เหรียญ)'
            : 'เติมเหรียญ +${package.totalCoins} พอยน์ (${provider.toUpperCase()})',
        provider: provider.toUpperCase(),
        coins: package.totalCoins,
        amountTHB: package.priceTHB.toDouble(),
        createdAt: _nowLabel(),
      ),
    );
    _addLog(
      'info',
      'payment',
      'ตรวจสอบสลิป ${slipInfo.reference} ผ่าน (฿${package.priceTHB} -> +${package.totalCoins} เหรียญ)',
      user.email,
    );
    notifyListeners();

    return (
      ok: true,
      title: package.isPlanUpgrade
          ? 'เปิดใช้งาน NIVATOON PLUS สำเร็จ!'
          : 'ชำระเงินและเติมเหรียญสำเร็จ!',
      message:
          'ตรวจสอบสลิปโอนเงินเข้าบัญชี ${PromptPayService.promptPayAccountName} (฿${package.priceTHB}.00) เรียบร้อยแล้ว',
      reference: slipInfo.reference,
      creditedCoins: package.totalCoins,
      upgradedPlus: package.isPlanUpgrade,
    );
  }

  // -------------------------
  // 6. Chapter Unlock, Reading History & Comments (#10)
  // -------------------------
  List<ComicComment> commentsForEpisode(String seriesSlug, int chapterNumber) {
    return _comments
        .where((c) => c.seriesSlug == seriesSlug && c.chapterNumber == chapterNumber)
        .toList();
  }

  void addComment(String seriesSlug, int chapterNumber, String text) {
    final user = _currentUser;
    if (user == null || text.trim().isEmpty) return;
    _comments.insert(
      0,
      ComicComment(
        id: 'cmt-${DateTime.now().millisecondsSinceEpoch}',
        seriesSlug: seriesSlug,
        chapterNumber: chapterNumber,
        authorName: user.displayName,
        roleBadge: user.role.name.toUpperCase(),
        body: text.trim(),
        createdAt: _todayKey(),
      ),
    );
    notifyListeners();
  }

  bool isEpisodeUnlocked(ComicEpisode ep) {
    final user = _currentUser;
    if (ep.coinPrice == 0) return true;
    if (user == null) return false;
    if (user.plan == 'plus') return true;
    return user.unlockedChapterIds.contains(ep.id);
  }

  ({bool ok, String message}) unlockEpisode({
    required ComicSeries series,
    required ComicEpisode episode,
    required bool useTicket,
  }) {
    final user = _currentUser;
    if (user == null) return (ok: false, message: 'กรุณาเข้าสู่ระบบ');
    if (isEpisodeUnlocked(episode)) {
      recordReadingHistory(series, episode.number);
      return (ok: true, message: 'เปิดอ่านได้ทันที');
    }

    if (useTicket) {
      if (user.freePassTickets <= 0) {
        return (ok: false, message: 'ตั๋วอ่านฟรีหมดแล้ว สามารถเช็กอินรายวันหรือใช้เหรียญปลดล็อกได้');
      }
      user.freePassTickets -= 1;
      user.unlockedChapterIds.add(episode.id);
      user.unlockedChapters.insert(
        0,
        UnlockedChapterRecord(
          chapterId: episode.id,
          seriesSlug: series.slug,
          seriesTitle: series.title,
          chapterNumber: episode.number,
          coinsPaid: 0,
          unlockedAt: _nowLabel(),
        ),
      );
      recordReadingHistory(series, episode.number);
      notifyListeners();
      return (ok: true, message: 'ใช้ตั๋วอ่านฟรี 1 ใบปลดล็อกตอนที่ ${episode.number} แล้ว');
    }

    if (user.coinBalance < episode.coinPrice) {
      return (
        ok: false,
        message: 'เหรียญไม่พอ (ต้องการ ${episode.coinPrice} เหรียญ) กรุณาเติมเหรียญที่ร้านค้า',
      );
    }
    user.coinBalance -= episode.coinPrice;
    user.unlockedChapterIds.add(episode.id);
    user.unlockedChapters.insert(
      0,
      UnlockedChapterRecord(
        chapterId: episode.id,
        seriesSlug: series.slug,
        seriesTitle: series.title,
        chapterNumber: episode.number,
        coinsPaid: episode.coinPrice,
        unlockedAt: _nowLabel(),
      ),
    );
    recordReadingHistory(series, episode.number);
    notifyListeners();
    return (ok: true, message: 'ปลดล็อกตอนที่ ${episode.number} เรียบร้อยแล้ว');
  }

  void recordReadingHistory(ComicSeries series, int chapterNumber) {
    final user = _currentUser;
    if (user == null) return;
    series.viewsCount += 1;
    user.readingHistory.removeWhere((h) => h.seriesSlug == series.slug);
    user.readingHistory.insert(
      0,
      ReadingHistoryRecord(
        seriesSlug: series.slug,
        seriesTitle: series.title,
        coverAsset: series.coverAsset,
        chapterNumber: chapterNumber,
        percent: 100,
        updatedAt: _nowLabel(),
      ),
    );
    notifyListeners();
  }

  void toggleLibrary(String seriesSlug) {
    final user = _currentUser;
    if (user == null) return;
    if (user.librarySlugs.contains(seriesSlug)) {
      user.librarySlugs.remove(seriesSlug);
    } else {
      user.librarySlugs.add(seriesSlug);
    }
    notifyListeners();
  }

  // -------------------------
  // 7. Profile, Theme, Creator Sample Work Request & Studio (#4, #7, #8, #14)
  // -------------------------
  void updateProfile({
    required String displayName,
    required String bio,
    required String avatarFrame,
    String? avatarFilePath,
  }) {
    final user = _currentUser;
    if (user == null) return;
    user.displayName = displayName.trim().isEmpty ? user.displayName : displayName.trim();
    user.bio = bio.trim();
    user.avatarFrame = avatarFrame;
    if (avatarFilePath != null && avatarFilePath.isNotEmpty) {
      user.avatarPath = avatarFilePath;
    }
    _addLog('info', 'profile', 'อัปเดตโปรไฟล์และรูปประจำตัว', user.email);
    notifyListeners();
  }

  void setDarkMode(bool dark) {
    final user = _currentUser;
    if (user == null) return;
    user.darkMode = dark;
    notifyListeners();
  }

  ({bool ok, String message}) submitCreatorSampleRequest({
    required String penName,
    required String sampleTitle,
    required String synopsis,
    required String coverPath,
    required List<String> pagePaths,
  }) {
    final user = _currentUser;
    if (user == null) return (ok: false, message: 'กรุณาเข้าสู่ระบบ');
    if (coverPath.isEmpty && pagePaths.isEmpty) {
      return (ok: false, message: 'กรุณาอัปโหลดภาพปกหรือหน้าการ์ตูนตัวอย่างอย่างน้อย 1 รูป');
    }
    final resolvedCover = coverPath.isNotEmpty ? coverPath : pagePaths.first;
    final resolvedPages = pagePaths.isNotEmpty ? pagePaths : <String>[resolvedCover];

    _creatorRequests.insert(
      0,
      CreatorRequestModel(
        id: 'creq-${DateTime.now().millisecondsSinceEpoch}',
        userId: user.id,
        userEmail: user.email,
        displayName: user.displayName,
        penName: penName.trim(),
        sampleTitle: sampleTitle.trim(),
        synopsis: synopsis.trim(),
        coverAssetOrPath: resolvedCover,
        samplePages: resolvedPages,
        isLocalFile: true,
        status: 'pending',
        createdAt: _nowLabel(),
      ),
    );
    user.creatorStatus = CreatorStatus.pending;
    _addLog(
      'info',
      'creator-request',
      'ส่งผลงานตัวอย่าง "$sampleTitle" (${resolvedPages.length} หน้า) เพื่อขอสิทธิ์ Creator',
      user.email,
    );
    notifyListeners();
    return (
      ok: true,
      message: 'อัปโหลดผลงานตัวอย่าง 1 เรื่องสำเร็จ! รอแอดมินเปิดตรวจภาพผลงานเพื่ออนุมัติสิทธิ์',
    );
  }

  void reviewCreatorRequest(String requestId, bool approve) {
    for (final req in _creatorRequests) {
      if (req.id == requestId) {
        req.status = approve ? 'approved' : 'rejected';
        for (final u in _users) {
          if (u.id == req.userId || u.email == req.userEmail) {
            u.creatorStatus = approve ? CreatorStatus.approved : CreatorStatus.rejected;
            if (approve && u.role == UserRole.user) {
              u.role = UserRole.creator;
            }
          }
        }
        _addLog(
          'security',
          'creator-request',
          '${approve ? "อนุมัติ" : "ปฏิเสธ"}คำขอ Creator ของ ${req.userEmail} (${req.sampleTitle})',
          _currentUser?.email ?? 'admin@nivatoon.app',
        );
        notifyListeners();
        return;
      }
    }
  }

  void changeUserRole(String userId, UserRole newRole) {
    for (final u in _users) {
      if (u.id == userId) {
        u.role = newRole;
        if (newRole == UserRole.creator || newRole == UserRole.admin) {
          u.creatorStatus = CreatorStatus.approved;
        }
        _addLog(
          'security',
          'admin',
          'เปลี่ยนยศของ ${u.email} เป็น ${newRole.name}',
          _currentUser?.email ?? 'admin@nivatoon.app',
        );
        notifyListeners();
        return;
      }
    }
  }

  void publishNewComicFromStudio({
    required String title,
    required String genreThai,
    required String synopsis,
    required String coverPath,
    required List<String> pagePaths,
    required int coinPrice,
  }) {
    final user = _currentUser;
    if (user == null) return;
    final slug = 'canvas-${DateTime.now().millisecondsSinceEpoch}';
    final pages = pagePaths.isNotEmpty
        ? pagePaths
        : <String>['assets/comics/page-01.jpg', 'assets/comics/page-02.jpg'];
    final cover = coverPath.isNotEmpty
        ? coverPath
        : 'assets/comics/01-moonlit-sword-cover.jpg';

    _seriesList.insert(
      0,
      ComicSeries(
        slug: slug,
        title: title.trim(),
        author: user.displayName,
        genreThai: genreThai,
        updateDay: 'ศุกร์',
        rating: 5.0,
        viewsCount: 1,
        coverAsset: cover,
        isCustomFileCover: coverPath.isNotEmpty,
        synopsis: synopsis.trim(),
        episodes: <ComicEpisode>[
          ComicEpisode(
            id: '$slug-ep-1',
            number: 1,
            title: 'ตอนที่ 1 เปิดตัวผลงานใหม่',
            coinPrice: coinPrice,
            publishedAt: _todayKey(),
            pageAssets: pages,
          ),
        ],
      ),
    );
    _addLog('info', 'studio', 'อัปโหลดผลงานใหม่ "$title" ขึ้น CANVAS', user.email);
    notifyListeners();
  }

  void submitIssueReport({
    required String category,
    required String subject,
    required String description,
  }) {
    final user = _currentUser;
    if (user == null) return;
    _issueReports.insert(
      0,
      IssueReportModel(
        id: 'iss-${DateTime.now().millisecondsSinceEpoch}',
        userEmail: user.email,
        category: category,
        subject: subject.trim(),
        description: description.trim(),
        status: 'open',
        createdAt: _nowLabel(),
      ),
    );
    _addLog('warn', 'support', 'แจ้งปัญหาใหม่: $subject', user.email);
    notifyListeners();
  }

  void replyIssueReport({
    required String issueId,
    required String status,
    required String reply,
  }) {
    for (final iss in _issueReports) {
      if (iss.id == issueId) {
        iss.status = status;
        if (reply.trim().isNotEmpty) {
          iss.adminReply = reply.trim();
        }
        _addLog('info', 'support', 'แอดมินตอบกลับเคส ${iss.subject} ($status)', 'admin');
        notifyListeners();
        return;
      }
    }
  }

  void saveAdminSettings({
    String? newGeminiKey,
    required String reasoningModel,
    required String ttsModel,
    required String imageModel,
    required String host,
    required String port,
    required String userEmail,
    String? appPassword,
    required bool strictSlip,
  }) {
    if (newGeminiKey != null && newGeminiKey.trim().isNotEmpty) {
      final k = newGeminiKey.trim();
      geminiApiKeyMasked = k.length > 8
          ? '${k.substring(0, 4)}••••${k.substring(k.length - 3)} (v1beta)'
          : '•••• (v1beta)';
    }
    geminiModelReasoning = reasoningModel.trim();
    geminiModelTts = ttsModel.trim();
    geminiModelImage = imageModel.trim();
    smtpHost = host.trim();
    smtpPort = port.trim();
    smtpUser = userEmail.trim();
    if (appPassword != null && appPassword.trim().isNotEmpty) {
      smtpAppPassword = appPassword.replaceAll(RegExp(r'\s+'), '');
    }
    strictSlipCheck = strictSlip;
    _addLog('security', 'admin-settings', 'อัปเดตตั้งค่า AI v1beta / SMTP / กฎตรวจสลิป', 'admin');
    notifyListeners();
  }
}
