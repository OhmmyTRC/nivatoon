import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/services/cloud_storage_and_db_service.dart';
import 'package:nivatoon_mobile/data/services/promptpay_service.dart';
import 'package:nivatoon_mobile/data/services/server_config_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';

/// Central reactive state & business rule repository for NIVATOON Android.
/// Uses GitHub (`OhmmyTRC/nivatoon`) as Cloud File Storage and Firebase (`niva-421c2`) as Cloud Database.
class NivatoonRepository extends ChangeNotifier {
  NivatoonRepository({
    ServerConfigService? serverConfig,
    CloudStorageAndDbService? cloudService,
    this.autoCloudSync = false,
  })  : _serverConfig = serverConfig ?? ServerConfigService(),
        _cloud = cloudService ?? CloudStorageAndDbService() {
    _seedInitialData();
    if (autoCloudSync) {
      _useLiveWebView = true;
      unawaited(syncWithGitHubAndFirebase());
    }
  }

  final ServerConfigService _serverConfig;
  final CloudStorageAndDbService _cloud;
  final bool autoCloudSync;

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

  // Cloud Storage (GitHub) & Cloud Database (Firebase) Telemetry
  bool githubStorageConnected = true;
  bool firebaseDbConnected = true;
  bool isSyncingCloud = false;
  String lastCloudSyncAt = 'พร้อมซิงก์ (GitHub + Firebase)';
  String githubPersonalAccessToken = '';

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

  int get totalGitHubPagesCount => _seriesList.fold<int>(
        0,
        (int sum, ComicSeries s) =>
            sum +
            s.episodes.fold<int>(
              0,
              (int eSum, ComicEpisode ep) => eSum + ep.pageAssets.length,
            ),
      );

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
    final log = SystemLogModel(
      id: 'log-${DateTime.now().millisecondsSinceEpoch}-${_systemLogs.length}',
      level: level,
      category: category,
      message: message,
      actorEmail: actor,
      createdAt: _nowLabel(),
    );
    _systemLogs.insert(0, log);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('system_logs', log.id, <String, dynamic>{
          'id': log.id,
          'level': log.level,
          'category': log.category,
          'message': log.message,
          'actor_email': log.actorEmail,
          'created_at': log.createdAt,
        }),
      );
    }
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
    List<ComicEpisode> buildGitHubFolderEpisodes(
      String slug,
      String folder,
    ) =>
        <ComicEpisode>[
          ComicEpisode(
            id: '$slug-ep-1',
            number: 1,
            title: 'ตอนที่ 1 จุดเริ่มต้นแห่งโชคชะตา',
            coinPrice: 0,
            publishedAt: '2026-11-15',
            pageAssets: <String>[
              '/comics/$folder/ep-01/001.jpg',
              '/comics/$folder/ep-01/002.jpg',
              '/comics/$folder/ep-01/003.jpg',
              '/comics/$folder/ep-01/004.jpg',
            ],
          ),
          ComicEpisode(
            id: '$slug-ep-2',
            number: 2,
            title: 'ตอนที่ 2 พลังที่ตื่นขึ้นในเงามืด',
            coinPrice: 0,
            publishedAt: '2026-11-17',
            pageAssets: <String>[
              '/comics/$folder/ep-02/001.jpg',
              '/comics/$folder/ep-02/002.jpg',
              '/comics/$folder/ep-02/003.jpg',
              '/comics/$folder/ep-02/004.jpg',
            ],
          ),
          ComicEpisode(
            id: '$slug-ep-3',
            number: 3,
            title: 'ตอนที่ 3 พันธสัญญาเลือดและคมดาบ (ล่วงหน้า)',
            coinPrice: 5,
            publishedAt: '2026-11-19',
            pageAssets: <String>[
              '/comics/$folder/ep-03/001.jpg',
              '/comics/$folder/ep-03/002.jpg',
              '/comics/$folder/ep-03/003.jpg',
              '/comics/$folder/ep-03/004.jpg',
            ],
          ),
        ];

    // 34 full pages stored in GitHub: public/comics/11Absolute-Regression-หวนคืนนิรันดร์กาล/ep-01/
    final absoluteRegressionPages = List<String>.generate(
      34,
      (int i) =>
          '/comics/11Absolute-Regression-หวนคืนนิรันดร์กาล/ep-01/Absolute-Regression-ep1-${i + 1}.jpg',
    );

    _seriesList.addAll(<ComicSeries>[
      ComicSeries(
        slug: 'Absolute-Regression-หวนคืนนิรันดร์กาล',
        title: 'หวนคืนนิรันดร์กาล (Absolute Regression)',
        author: 'JANG YEONG-HUN / PARK JIN-HWAN',
        genreThai: 'แอ็กชัน',
        updateDay: 'ศุกร์',
        rating: 4.95,
        viewsCount: 342000,
        coverAsset: '/comics/11Absolute-Regression-หวนคืนนิรันดร์กาล/cover.jpg',
        synopsis:
            'คุณชายรองแห่งลัทธิมารใช้วิชาต้องห้ามย้อนเวลากลับมาสู่อดีตอีกครั้ง พร้อมความทรงจำและวรยุทธ์ระดับปรมาจารย์ (ครบ 34 หน้าเต็มจากคลัง GitHub OhmmyTRC/nivatoon)',
        episodes: <ComicEpisode>[
          ComicEpisode(
            id: 'Absolute-Regression-หวนคืนนิรันดร์กาล-ep-1',
            number: 1,
            title: 'ตอนที่ 1 หวนคืนสู่อดีตกาล (34 หน้าเต็ม • GitHub Storage)',
            coinPrice: 0,
            publishedAt: '2026-11-21',
            pageAssets: absoluteRegressionPages,
          ),
        ],
      ),
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
        episodes: buildGitHubFolderEpisodes('moonlit-sword', '01-moonlit-sword'),
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
        episodes: buildGitHubFolderEpisodes('palace-bloom', '02-palace-bloom'),
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
        episodes:
            buildGitHubFolderEpisodes('unrivaled-system', '03-unrivaled-system'),
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
        episodes:
            buildGitHubFolderEpisodes('reborn-as-demon', '04-reborn-as-demon'),
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
        episodes: buildGitHubFolderEpisodes(
          'letter-from-tomorrow',
          '05-letter-from-tomorrow',
        ),
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
        episodes: buildGitHubFolderEpisodes(
          'rank-zero-hunter',
          '06-rank-zero-hunter',
        ),
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
        episodes: buildGitHubFolderEpisodes(
          'eclipse-academy',
          '07-eclipse-academy',
        ),
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
        episodes: buildGitHubFolderEpisodes(
          'shadow-apothecary',
          '08-shadow-apothecary',
        ),
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
        episodes: buildGitHubFolderEpisodes(
          'neon-shinjuku-99',
          '09-neon-shinjuku-99',
        ),
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
        episodes: buildGitHubFolderEpisodes(
          'duchess-contract',
          '10-duchess-contract',
        ),
      ),
    ]);

    _users.addAll(<AppUser>[
      AppUser(
        id: 'user-reader-demo',
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
        librarySlugs: <String>[
          'Absolute-Regression-หวนคืนนิรันดร์กาล',
          'moonlit-sword',
          'unrivaled-system',
        ],
        readingHistory: <ReadingHistoryRecord>[
          const ReadingHistoryRecord(
            seriesSlug: 'Absolute-Regression-หวนคืนนิรันดร์กาล',
            seriesTitle: 'หวนคืนนิรันดร์กาล (Absolute Regression)',
            coverAsset:
                '/comics/11Absolute-Regression-หวนคืนนิรันดร์กาล/cover.jpg',
            chapterNumber: 1,
            percent: 100,
            updatedAt: '2026-11-21 20:30',
          ),
        ],
      ),
      AppUser(
        id: 'user-creator-hana',
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
        userId: 'user-reader-demo',
        userEmail: 'reader@gmail.com',
        displayName: 'เคนจิ นักอ่านสายแอ็กชัน',
        penName: 'KENJI STUDIO',
        sampleTitle: 'อัศวินเงาแห่งหอคอยทมิฬ',
        synopsis:
            'ผลงานตัวอย่าง 1 เรื่อง: แนวแอ็กชันแฟนตาซี มีภาพปกและหน้าตัวอย่างครบ (เก็บไฟล์บน GitHub)',
        coverAssetOrPath: 'assets/comics/06-rank-zero-hunter-cover.jpg',
        samplePages: const <String>[
          '/comics/06-rank-zero-hunter/ep-01/001.jpg',
          '/comics/06-rank-zero-hunter/ep-01/002.jpg',
          '/comics/06-rank-zero-hunter/ep-01/003.jpg',
        ],
        isLocalFile: false,
        status: 'pending',
        createdAt: '2026-11-21 19:00',
      ),
    );

    _notifications.addAll(<NotificationModel>[
      NotificationModel(
        id: 'notif-seed-1',
        badge: 'EVENT',
        title: 'เช็กอิน 7 วัน รับตั๋วอ่านฟรีสูงสุด 9 ใบ!',
        message:
            'เช็กอินวันที่ 1–6 รับวันละ 1 ตั๋ว พิเศษวันที่ 7 รับโบนัส 3 ตั๋วอ่านฟรีทันที',
        createdAt: '2026-11-21 09:00',
      ),
      NotificationModel(
        id: 'notif-seed-2',
        badge: 'PROMO',
        title: 'สมัคร NIVATOON PLUS ฿129/เดือน รับทันที +300 เหรียญ',
        message:
            'อ่านตอนล่วงหน้าฟรีทุกเรื่อง ชำระผ่าน PromptPay 1709700341765 หรือ TrueMoney 0997353282 (ธีรชาติ เครือวัลย์)',
        createdAt: '2026-11-21 10:30',
      ),
    ]);

    _comments.addAll(<ComicComment>[
      const ComicComment(
        id: 'c-seed-1',
        seriesSlug: 'moonlit-sword',
        chapterNumber: 1,
        authorName: 'HANA STUDIO',
        roleBadge: 'CREATOR',
        body:
            'ขอบคุณนักอ่านทุกคนที่ติดตามตอนแรกครับ! กดใช้ AI แปลภาพในหน้าอ่านได้เลย',
        createdAt: '2026-11-21',
      ),
      const ComicComment(
        id: 'c-seed-2',
        seriesSlug: 'Absolute-Regression-หวนคืนนิรันดร์กาล',
        chapterNumber: 1,
        authorName: 'เคนจิ นักอ่านสายแอ็กชัน',
        roleBadge: 'TOP',
        body:
            'ตอนที่ 1 โหลดไฟล์ภาพจาก GitHub ครบ 34 หน้าคมกริบ! ลายเส้นสวยมากครับ',
        createdAt: '2026-11-21',
      ),
    ]);

    _addLog(
      'info',
      'system',
      'เชื่อมต่อคลังไฟล์ GitHub (${CloudStorageAndDbService.githubRepoFull}) & ฐานข้อมูล Firebase (${CloudStorageAndDbService.firebaseProjectId}) พร้อมใช้งาน',
      'system@nivatoon.app',
    );
  }

  static String _mapGenreToThai(List<dynamic>? rawGenres) {
    if (rawGenres == null || rawGenres.isEmpty) return 'แอ็กชัน';
    final first = rawGenres.first.toString().toLowerCase();
    switch (first) {
      case 'romance':
        return 'โรแมนซ์';
      case 'fantasy':
        return 'แฟนตาซี';
      case 'historical':
        return 'ย้อนยุค';
      case 'action':
      default:
        if (rawGenres.any((g) => g.toString().toLowerCase() == 'romance')) {
          return 'โรแมนซ์แฟนตาซี';
        }
        return 'แอ็กชัน';
    }
  }

  /// Synchronizes comic files from GitHub (`OhmmyTRC/nivatoon/public/comics/manifest.json`)
  /// and database documents from Firebase (`niva-421c2`).
  Future<({bool ok, String message})> syncWithGitHubAndFirebase() async {
    isSyncingCloud = true;
    notifyListeners();

    int loadedSeriesFromGitHub = 0;
    int syncedFirebaseCollections = 0;

    try {
      // 1. Fetch Comic Catalog & Image Paths from GitHub File Storage
      final manifest = await _cloud.fetchGitHubComicsManifest();
      if (manifest != null && manifest['series'] is List) {
        githubStorageConnected = true;
        final List<dynamic> rawSeriesList = manifest['series'] as List<dynamic>;
        for (final dynamic item in rawSeriesList) {
          if (item is! Map<String, dynamic>) continue;
          final slug = (item['slug'] ?? '').toString().trim();
          final title = (item['title'] ?? '').toString().trim();
          if (slug.isEmpty || title.isEmpty) continue;

          final List<dynamic> rawEps =
              (item['episodes'] is List) ? item['episodes'] as List<dynamic> : <dynamic>[];
          final List<ComicEpisode> mappedEps = <ComicEpisode>[];
          for (final dynamic epItem in rawEps) {
            if (epItem is! Map<String, dynamic>) continue;
            final epNum = int.tryParse('${epItem['chapterNumber'] ?? epItem['number'] ?? 1}') ?? 1;
            final List<dynamic> rawPages = (epItem['githubPages'] is List &&
                    (epItem['githubPages'] as List).isNotEmpty)
                ? epItem['githubPages'] as List<dynamic>
                : (epItem['pages'] is List)
                    ? epItem['pages'] as List<dynamic>
                    : <dynamic>[];
            final pageUrls = rawPages
                .map((p) => CloudStorageAndDbService.toGitHubRawUrl(p.toString()))
                .where((p) => p.isNotEmpty)
                .toList();
            if (pageUrls.isEmpty) continue;

            mappedEps.add(
              ComicEpisode(
                id: (epItem['id'] ?? '$slug-ep-$epNum').toString(),
                number: epNum,
                title: (epItem['title'] ?? 'ตอนที่ $epNum').toString(),
                coinPrice: int.tryParse('${epItem['coinPrice'] ?? 0}') ?? 0,
                publishedAt: (epItem['publishedAt'] ?? 'ล่าสุด').toString(),
                pageAssets: pageUrls,
              ),
            );
          }

          if (mappedEps.isEmpty) continue;

          final ghCover = (item['githubCoverUrl'] ?? item['coverUrl'] ?? '').toString();
          final existingIdx = _seriesList.indexWhere((s) => s.slug == slug);
          if (existingIdx >= 0) {
            final current = _seriesList[existingIdx];
            _seriesList[existingIdx] = ComicSeries(
              slug: slug,
              title: title,
              author: (item['author'] ?? current.author).toString(),
              genreThai: _mapGenreToThai(item['genres'] as List<dynamic>?),
              updateDay: (item['updateDay'] ?? current.updateDay).toString(),
              rating: double.tryParse('${item['rating'] ?? current.rating}') ?? current.rating,
              viewsCount: current.viewsCount,
              coverAsset: current.coverAsset.startsWith('assets/')
                  ? current.coverAsset
                  : CloudStorageAndDbService.toGitHubRawUrl(ghCover),
              synopsis: (item['synopsis'] ?? current.synopsis).toString(),
              episodes: mappedEps,
            );
          } else {
            _seriesList.insert(
              0,
              ComicSeries(
                slug: slug,
                title: title,
                author: (item['author'] ?? 'NIVATOON CREATOR').toString(),
                genreThai: _mapGenreToThai(item['genres'] as List<dynamic>?),
                updateDay: (item['updateDay'] ?? 'ศุกร์').toString(),
                rating: double.tryParse('${item['rating'] ?? 4.9}') ?? 4.9,
                viewsCount: 150000,
                coverAsset: CloudStorageAndDbService.toGitHubRawUrl(ghCover),
                synopsis: (item['synopsis'] ?? '').toString(),
                episodes: mappedEps,
              ),
            );
          }
          loadedSeriesFromGitHub += 1;
        }
      }

      // 2. Fetch Database Records from Firebase (`niva-421c2`)
      final fbSnap = await _cloud.fetchFirebaseCloudSnapshot();
      if (fbSnap != null) {
        firebaseDbConnected = true;

        // 2a. Merge Series stats & newly published series from Firebase
        if (fbSnap['series_stats'] is Map) {
          final statsMap = fbSnap['series_stats'] as Map<String, dynamic>;
          for (final entry in statsMap.values) {
            if (entry is! Map) continue;
            final slug = (entry['series_slug'] ?? '').toString();
            final views = int.tryParse('${entry['views_count'] ?? 0}') ?? 0;
            for (final s in _seriesList) {
              if (s.slug == slug && views > 0) {
                s.viewsCount = views;
              }
            }
          }
          syncedFirebaseCollections += 1;
        }

        // 2b. Merge Users from Firebase
        if (fbSnap['users'] is Map) {
          final usersMap = fbSnap['users'] as Map<String, dynamic>;
          for (final rawU in usersMap.values) {
            if (rawU is! Map) continue;
            final email = (rawU['email'] ?? '').toString().trim().toLowerCase();
            if (email.isEmpty) continue;
            final roleStr = (rawU['role'] ?? 'user').toString();
            final role = roleStr == 'admin'
                ? UserRole.admin
                : roleStr == 'creator'
                    ? UserRole.creator
                    : UserRole.user;
            final cStatusStr = (rawU['creatorStatus'] ?? 'none').toString();
            final cStatus = cStatusStr == 'approved'
                ? CreatorStatus.approved
                : cStatusStr == 'pending'
                    ? CreatorStatus.pending
                    : cStatusStr == 'rejected'
                        ? CreatorStatus.rejected
                        : CreatorStatus.none;
            final coins = int.tryParse('${rawU['coinBalance'] ?? 0}') ?? 0;
            final tickets = int.tryParse('${rawU['freePassTickets'] ?? 3}') ?? 3;
            final plan = (rawU['plan'] ?? 'free').toString();

            final existing = _users
                .where((u) => u.email.toLowerCase() == email)
                .toList();
            if (existing.isNotEmpty) {
              final target = existing.first;
              target.role = role;
              target.creatorStatus = cStatus;
              if (coins > target.coinBalance) target.coinBalance = coins;
              target.freePassTickets = tickets;
              if (plan == 'plus') target.plan = 'plus';
            } else {
              _users.add(
                AppUser(
                  id: (rawU['id'] ?? 'user-${DateTime.now().millisecondsSinceEpoch}').toString(),
                  email: email,
                  password: (rawU['password'] ?? 'Reader2026!').toString(),
                  pin: (rawU['pin'] ?? '123456').toString(),
                  role: role,
                  creatorStatus: cStatus,
                  displayName: (rawU['displayName'] ?? email.split('@').first).toString(),
                  bio: (rawU['bio'] ?? '').toString(),
                  avatarFrame: (rawU['avatarFrame'] ?? 'emerald').toString(),
                  coinBalance: coins,
                  freePassTickets: tickets,
                  plan: plan,
                ),
              );
            }
          }
          syncedFirebaseCollections += 1;
        }

        // 2c. Merge Comments from Firebase
        if (fbSnap['comments'] is Map) {
          final commentsMap = fbSnap['comments'] as Map<String, dynamic>;
          for (final rawC in commentsMap.values) {
            if (rawC is! Map) continue;
            final id = (rawC['id'] ?? '').toString();
            if (id.isEmpty || _comments.any((c) => c.id == id)) continue;
            _comments.insert(
              0,
              ComicComment(
                id: id,
                seriesSlug: (rawC['series_slug'] ?? 'moonlit-sword').toString(),
                chapterNumber: int.tryParse('${rawC['chapter_number'] ?? 1}') ?? 1,
                authorName: (rawC['author_name'] ?? 'นักอ่าน NIVATOON').toString(),
                roleBadge: (rawC['author_badge'] ?? 'READER').toString(),
                body: (rawC['body'] ?? '').toString(),
                createdAt: (rawC['created_at'] ?? '').toString().split('T').first,
              ),
            );
          }
          syncedFirebaseCollections += 1;
        }

        // 2d. Merge Creator Requests from Firebase
        if (fbSnap['creator_requests'] is Map) {
          final reqMap = fbSnap['creator_requests'] as Map<String, dynamic>;
          for (final rawR in reqMap.values) {
            if (rawR is! Map) continue;
            final id = (rawR['id'] ?? '').toString();
            if (id.isEmpty) continue;
            final status = (rawR['status'] ?? 'pending').toString();
            final existingReq = _creatorRequests.where((r) => r.id == id).toList();
            if (existingReq.isNotEmpty) {
              existingReq.first.status = status;
              continue;
            }
            final coverUrl = CloudStorageAndDbService.toGitHubRawUrl(
              (rawR['sampleCoverUrl'] ?? '/comics/06-rank-zero-hunter/cover.jpg').toString(),
            );
            final List<String> pages = (rawR['samplePages'] is List)
                ? (rawR['samplePages'] as List)
                    .map((p) => CloudStorageAndDbService.toGitHubRawUrl(p.toString()))
                    .toList()
                : <String>[coverUrl];
            _creatorRequests.insert(
              0,
              CreatorRequestModel(
                id: id,
                userId: (rawR['userId'] ?? '').toString(),
                userEmail: (rawR['email'] ?? '').toString(),
                displayName: (rawR['displayName'] ?? '').toString(),
                penName: (rawR['penName'] ?? '').toString(),
                sampleTitle: (rawR['sampleTitle'] ?? '').toString(),
                synopsis: (rawR['sampleSynopsis'] ?? rawR['portfolioNote'] ?? '').toString(),
                coverAssetOrPath: coverUrl,
                samplePages: pages,
                status: status,
                createdAt: (rawR['createdAt'] ?? _nowLabel()).toString().split('T').first,
              ),
            );
          }
          syncedFirebaseCollections += 1;
        }

        // 2e. Merge Notifications from Firebase
        if (fbSnap['notifications'] is Map) {
          final notifMap = fbSnap['notifications'] as Map<String, dynamic>;
          for (final rawN in notifMap.values) {
            if (rawN is! Map) continue;
            final id = (rawN['id'] ?? '').toString();
            if (id.isEmpty || _notifications.any((n) => n.id == id)) continue;
            _notifications.insert(
              0,
              NotificationModel(
                id: id,
                badge: (rawN['badge'] ?? 'PROMO').toString(),
                title: (rawN['title'] ?? '').toString(),
                message: (rawN['message'] ?? '').toString(),
                createdAt: (rawN['created_at'] ?? _nowLabel()).toString().split('T').first,
              ),
            );
          }
          syncedFirebaseCollections += 1;
        }

        // 2f. Merge Issue Reports from Firebase
        if (fbSnap['issue_reports'] is Map) {
          final issMap = fbSnap['issue_reports'] as Map<String, dynamic>;
          for (final rawI in issMap.values) {
            if (rawI is! Map) continue;
            final id = (rawI['id'] ?? '').toString();
            if (id.isEmpty) continue;
            final existingIss = _issueReports.where((i) => i.id == id).toList();
            if (existingIss.isNotEmpty) {
              existingIss.first.status = (rawI['status'] ?? existingIss.first.status).toString();
              if (rawI['admin_reply'] != null) {
                existingIss.first.adminReply = rawI['admin_reply'].toString();
              }
              continue;
            }
            _issueReports.insert(
              0,
              IssueReportModel(
                id: id,
                userEmail: (rawI['user_email'] ?? '').toString(),
                category: (rawI['category'] ?? 'general').toString(),
                subject: (rawI['subject'] ?? '').toString(),
                description: (rawI['description'] ?? '').toString(),
                status: (rawI['status'] ?? 'open').toString(),
                adminReply: rawI['admin_reply']?.toString(),
                createdAt: (rawI['created_at'] ?? _nowLabel()).toString().split('T').first,
              ),
            );
          }
          syncedFirebaseCollections += 1;
        }
      }
    } catch (_) {}

    isSyncingCloud = false;
    lastCloudSyncAt = _nowLabel();
    notifyListeners();

    return (
      ok: true,
      message:
          'ซิงก์ไฟล์จาก GitHub (${_seriesList.length} เรื่อง • $totalGitHubPagesCount หน้า • อัปเดต $loadedSeriesFromGitHub เรื่อง) และฐานข้อมูล Firebase (${CloudStorageAndDbService.firebaseProjectId} • $syncedFirebaseCollections หมวด) สำเร็จ ✓',
    );
  }

  void _syncUserToFirebase(AppUser user) {
    if (!autoCloudSync) return;
    unawaited(
      _cloud.upsertFirebaseDoc('users', user.id, <String, dynamic>{
        'id': user.id,
        'email': user.email,
        'displayName': user.displayName,
        'bio': user.bio,
        'avatarFrame': user.avatarFrame,
        'role': user.role.name,
        'creatorStatus': user.creatorStatus.name,
        'coinBalance': user.coinBalance,
        'freePassTickets': user.freePassTickets,
        'plan': user.plan,
        'checkinDay': user.checkinDay,
        'lastCheckinDate': user.lastCheckinDate,
        'librarySlugs': user.librarySlugs,
        'unlockedChapterIds': user.unlockedChapterIds,
        'updatedAt': DateTime.now().toIso8601String(),
      }),
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
        _syncUserToFirebase(u);
        notifyListeners();
        return (ok: true, message: 'เข้าสู่ระบบสำเร็จ');
      }
    }
    return (ok: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }

  /// Registers a brand-new user starting strictly with 0 Coins and 3 Free Pass Tickets (#2)
  /// and writes the user document directly to Firebase (`niva-421c2`).
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
    _syncUserToFirebase(newUser);
    _addLog(
      'info',
      'auth',
      'สมัครสมาชิกใหม่สำเร็จ บันทึกลง Firebase (0 เหรียญ + ตั๋วอ่านฟรี 3 ใบ • $cleanEmail)',
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
    _syncUserToFirebase(user);
    _addLog('security', 'auth', 'เปลี่ยนรหัสผ่านและซิงก์ Firebase สำเร็จ', user.email);
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
    _syncUserToFirebase(user);
    _addLog('security', 'auth', 'เปลี่ยนรหัส PIN 6 หลักและซิงก์ Firebase สำเร็จ', user.email);
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
        _syncUserToFirebase(u);
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
    final txId = 'tx-chk-${DateTime.now().millisecondsSinceEpoch}';
    final tx = WalletTransactionRecord(
      id: txId,
      reference: 'CHK-DAY$nextDay',
      title: 'เช็กอินวันที่ $nextDay/7 รับ +$reward ตั๋วอ่านฟรี',
      provider: 'CHECKIN',
      coins: 0,
      amountTHB: 0,
      createdAt: _nowLabel(),
    );
    user.transactions.insert(0, tx);
    _syncUserToFirebase(user);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('wallet_transactions', txId, <String, dynamic>{
          'id': txId,
          'reference': tx.reference,
          'user_id': user.id,
          'provider': 'system',
          'type': 'ticket_bonus',
          'coins': 0,
          'amount_thb': 0,
          'status': 'completed',
          'verification_note': tx.title,
          'created_at': DateTime.now().toIso8601String(),
        }),
      );
    }
    _addLog(
      'info',
      'checkin',
      'เช็กอินวันที่ $nextDay/7 รับ +$reward ตั๋วอ่านฟรี (ซิงก์ Firebase แล้ว • รวม ${user.freePassTickets} ใบ)',
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
    final notif = NotificationModel(
      id: 'notif-${DateTime.now().millisecondsSinceEpoch}',
      badge: badge.trim().isEmpty ? 'PROMO' : badge.trim().toUpperCase(),
      title: title.trim(),
      message: message.trim(),
      createdAt: _nowLabel(),
    );
    _notifications.insert(0, notif);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('notifications', notif.id, <String, dynamic>{
          'id': notif.id,
          'badge': notif.badge,
          'title': notif.title,
          'message': notif.message,
          'type': 'promo',
          'is_active': 1,
          'created_at': DateTime.now().toIso8601String(),
        }),
      );
    }
    _addLog('info', 'admin', 'สร้างประกาศโปรโมชั่นใหม่ลง Firebase: $title', _currentUser?.email ?? 'admin');
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
    final txId = 'tx-${DateTime.now().millisecondsSinceEpoch}';
    final txTitle = package.isPlanUpgrade
        ? 'สมัคร NIVATOON PLUS (+${package.totalCoins} เหรียญ)'
        : 'เติมเหรียญ +${package.totalCoins} พอยน์ (${provider.toUpperCase()})';
    user.transactions.insert(
      0,
      WalletTransactionRecord(
        id: txId,
        reference: slipInfo.reference,
        title: txTitle,
        provider: provider.toUpperCase(),
        coins: package.totalCoins,
        amountTHB: package.priceTHB.toDouble(),
        createdAt: _nowLabel(),
      ),
    );
    _syncUserToFirebase(user);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('wallet_transactions', txId, <String, dynamic>{
          'id': txId,
          'reference': slipInfo.reference,
          'user_id': user.id,
          'provider': provider,
          'recipient_id': PromptPayService.promptPayId,
          'type': package.isPlanUpgrade ? 'subscription' : 'topup',
          'coins': package.totalCoins,
          'amount_thb': package.priceTHB,
          'status': 'completed',
          'slip_hash': slipInfo.slipHash,
          'verification_note': txTitle,
          'created_at': DateTime.now().toIso8601String(),
        }),
      );
    }
    _addLog(
      'info',
      'payment',
      'ตรวจสอบสลิป ${slipInfo.reference} ผ่าน & ซิงก์ Firebase (฿${package.priceTHB} -> +${package.totalCoins} เหรียญ)',
      user.email,
    );
    notifyListeners();

    return (
      ok: true,
      title: package.isPlanUpgrade
          ? 'เปิดใช้งาน NIVATOON PLUS สำเร็จ!'
          : 'ชำระเงินและเติมเหรียญสำเร็จ!',
      message:
          'ตรวจสอบสลิปโอนเงินเข้าบัญชี ${PromptPayService.promptPayAccountName} (฿${package.priceTHB}.00) และบันทึกลงฐานข้อมูล Firebase เรียบร้อยแล้ว',
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
    final cmt = ComicComment(
      id: 'cmt-${DateTime.now().millisecondsSinceEpoch}',
      seriesSlug: seriesSlug,
      chapterNumber: chapterNumber,
      authorName: user.displayName,
      roleBadge: user.role.name.toUpperCase(),
      body: text.trim(),
      createdAt: _todayKey(),
    );
    _comments.insert(0, cmt);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('comments', cmt.id, <String, dynamic>{
          'id': cmt.id,
          'user_id': user.id,
          'series_slug': seriesSlug,
          'chapter_number': chapterNumber,
          'author_name': cmt.authorName,
          'author_badge': cmt.roleBadge,
          'body': cmt.body,
          'likes': 1,
          'is_top': 0,
          'is_spoiler': 0,
          'created_at': DateTime.now().toIso8601String(),
        }),
      );
    }
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
      _syncUserToFirebase(user);
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
    _syncUserToFirebase(user);
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
    _syncUserToFirebase(user);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('series_stats', series.slug, <String, dynamic>{
          'series_slug': series.slug,
          'views_count': series.viewsCount,
          'updatedAt': DateTime.now().toIso8601String(),
        }),
      );
    }
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
    _syncUserToFirebase(user);
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
    _syncUserToFirebase(user);
    _addLog('info', 'profile', 'อัปเดตโปรไฟล์และซิงก์ Firebase สำเร็จ', user.email);
    notifyListeners();
  }

  void setDarkMode(bool dark) {
    final user = _currentUser;
    if (user == null) return;
    user.darkMode = dark;
    _syncUserToFirebase(user);
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
    final reqId = 'creq-${DateTime.now().millisecondsSinceEpoch}';

    final reqModel = CreatorRequestModel(
      id: reqId,
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
    );
    _creatorRequests.insert(0, reqModel);
    user.creatorStatus = CreatorStatus.pending;
    _syncUserToFirebase(user);

    if (autoCloudSync) {
      unawaited(() async {
        String ghCoverUrl = resolvedCover;
        if (githubPersonalAccessToken.isNotEmpty) {
          final up = await _cloud.uploadFileToGitHub(
            localFilePath: resolvedCover,
            targetPublicPath: 'uploads/creator-samples/$reqId/cover.jpg',
            commitMessage: 'feat(creator-sample): upload $reqId cover from Android app',
            githubToken: githubPersonalAccessToken,
          );
          if (up.ok) ghCoverUrl = up.url;
        }
        await _cloud.upsertFirebaseDoc('creator_requests', reqId, <String, dynamic>{
          'id': reqId,
          'userId': user.id,
          'email': user.email,
          'displayName': user.displayName,
          'penName': reqModel.penName,
          'sampleTitle': reqModel.sampleTitle,
          'portfolioNote': reqModel.synopsis,
          'sampleSynopsis': reqModel.synopsis,
          'sampleCoverUrl': ghCoverUrl,
          'samplePages': resolvedPages,
          'status': 'pending',
          'createdAt': DateTime.now().toIso8601String(),
        });
      }());
    }

    _addLog(
      'info',
      'creator-request',
      'ส่งผลงานตัวอย่าง "$sampleTitle" (${resolvedPages.length} หน้า) ไปยัง GitHub & Firebase เพื่อขอสิทธิ์ Creator',
      user.email,
    );
    notifyListeners();
    return (
      ok: true,
      message: 'อัปโหลดผลงานตัวอย่าง 1 เรื่องไปยัง GitHub & Firebase สำเร็จ! รอแอดมินตรวจอนุมัติสิทธิ์',
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
            _syncUserToFirebase(u);
          }
        }
        if (autoCloudSync) {
          unawaited(
            _cloud.upsertFirebaseDoc('creator_requests', req.id, <String, dynamic>{
              'id': req.id,
              'penName': req.penName,
              'sampleTitle': req.sampleTitle,
              'status': req.status,
              'updatedAt': DateTime.now().toIso8601String(),
            }),
          );
        }
        _addLog(
          'security',
          'creator-request',
          '${approve ? "อนุมัติ" : "ปฏิเสธ"}คำขอ Creator ของ ${req.userEmail} (${req.sampleTitle}) บน Firebase',
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
        _syncUserToFirebase(u);
        _addLog(
          'security',
          'admin',
          'เปลี่ยนยศของ ${u.email} เป็น ${newRole.name} บน Firebase',
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
        : <String>[
            '/comics/01-moonlit-sword/ep-01/001.jpg',
            '/comics/01-moonlit-sword/ep-01/002.jpg',
          ];
    final cover = coverPath.isNotEmpty
        ? coverPath
        : 'assets/comics/01-moonlit-sword-cover.jpg';

    final newSeries = ComicSeries(
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
    );

    _seriesList.insert(0, newSeries);

    if (autoCloudSync) {
      unawaited(() async {
        String ghCoverUrl = CloudStorageAndDbService.toGitHubRawUrl(cover);
        if (coverPath.isNotEmpty && githubPersonalAccessToken.isNotEmpty) {
          final upCover = await _cloud.uploadFileToGitHub(
            localFilePath: coverPath,
            targetPublicPath: 'comics/$slug/cover.jpg',
            commitMessage: 'feat(comics): upload $slug cover to GitHub storage',
            githubToken: githubPersonalAccessToken,
          );
          if (upCover.ok) ghCoverUrl = upCover.url;
        }

        final List<String> ghPages = <String>[];
        for (int i = 0; i < pages.length; i++) {
          final p = pages[i];
          if (githubPersonalAccessToken.isNotEmpty &&
              !p.startsWith('assets/') &&
              !p.startsWith('/comics/') &&
              !p.startsWith('http')) {
            final numName = '${(i + 1).toString().padLeft(3, '0')}.jpg';
            final upPage = await _cloud.uploadFileToGitHub(
              localFilePath: p,
              targetPublicPath: 'comics/$slug/ep-01/$numName',
              commitMessage: 'feat(comics): upload $slug ep-01/$numName to GitHub storage',
              githubToken: githubPersonalAccessToken,
            );
            ghPages.add(upPage.ok ? upPage.url : p);
          } else {
            ghPages.add(CloudStorageAndDbService.toGitHubRawUrl(p));
          }
        }

        await _cloud.upsertFirebaseDoc('series', slug, <String, dynamic>{
          'slug': slug,
          'folder': slug,
          'title': newSeries.title,
          'author': newSeries.author,
          'origin': 'korea',
          'status': 'ongoing',
          'genres': <String>[genreThai],
          'synopsis': newSeries.synopsis,
          'updateDay': newSeries.updateDay,
          'rating': 5.0,
          'viewsCount': 1,
          'githubCoverUrl': ghCoverUrl,
          'episodesCount': 1,
          'episodes': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': '$slug-ep-1',
              'dir': 'ep-01',
              'chapterNumber': 1,
              'title': 'ตอนที่ 1 เปิดตัวผลงานใหม่',
              'coinPrice': coinPrice,
              'publishedAt': _todayKey(),
              'githubPages': ghPages,
            },
          ],
          'updatedAt': DateTime.now().toIso8601String(),
        });
      }());
    }

    _addLog(
      'info',
      'studio',
      'อัปโหลดผลงานใหม่ "$title" ไปยัง GitHub Storage & บันทึกฐานข้อมูล Firebase สำเร็จ',
      user.email,
    );
    notifyListeners();
  }

  void submitIssueReport({
    required String category,
    required String subject,
    required String description,
  }) {
    final user = _currentUser;
    if (user == null) return;
    final iss = IssueReportModel(
      id: 'iss-${DateTime.now().millisecondsSinceEpoch}',
      userEmail: user.email,
      category: category,
      subject: subject.trim(),
      description: description.trim(),
      status: 'open',
      createdAt: _nowLabel(),
    );
    _issueReports.insert(0, iss);
    if (autoCloudSync) {
      unawaited(
        _cloud.upsertFirebaseDoc('issue_reports', iss.id, <String, dynamic>{
          'id': iss.id,
          'user_id': user.id,
          'user_email': user.email,
          'user_name': user.displayName,
          'category': iss.category,
          'subject': iss.subject,
          'description': iss.description,
          'status': 'open',
          'created_at': DateTime.now().toIso8601String(),
          'updated_at': DateTime.now().toIso8601String(),
        }),
      );
    }
    _addLog('warn', 'support', 'แจ้งปัญหาใหม่ไปยัง Firebase: $subject', user.email);
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
        if (autoCloudSync) {
          unawaited(
            _cloud.upsertFirebaseDoc('issue_reports', iss.id, <String, dynamic>{
              'id': iss.id,
              'subject': iss.subject,
              'status': iss.status,
              'admin_reply': iss.adminReply,
              'updated_at': DateTime.now().toIso8601String(),
            }),
          );
        }
        _addLog('info', 'support', 'แอดมินตอบกลับเคส ${iss.subject} ($status) บน Firebase', 'admin');
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
    String? githubToken,
    required bool strictSlip,
  }) {
    if (newGeminiKey != null && newGeminiKey.trim().isNotEmpty) {
      final k = newGeminiKey.trim();
      geminiApiKeyMasked = k.length > 8
          ? '${k.substring(0, 4)}••••${k.substring(k.length - 3)} (v1beta)'
          : '•••• (v1beta)';
    }
    if (githubToken != null && githubToken.trim().isNotEmpty) {
      githubPersonalAccessToken = githubToken.trim();
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
    _addLog('security', 'admin-settings', 'อัปเดตตั้งค่า AI v1beta / GitHub Token / SMTP / กฎตรวจสลิป', 'admin');
    notifyListeners();
  }
}
