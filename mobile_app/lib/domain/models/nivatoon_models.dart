/// Domain models for the native Dart NIVATOON Android application.
enum UserRole { user, creator, admin }

enum CreatorStatus { none, pending, approved, rejected }

class UnlockedChapterRecord {
  const UnlockedChapterRecord({
    required this.chapterId,
    required this.seriesSlug,
    required this.seriesTitle,
    required this.chapterNumber,
    required this.coinsPaid,
    required this.unlockedAt,
  });

  final String chapterId;
  final String seriesSlug;
  final String seriesTitle;
  final int chapterNumber;
  final int coinsPaid;
  final String unlockedAt;
}

class ReadingHistoryRecord {
  const ReadingHistoryRecord({
    required this.seriesSlug,
    required this.seriesTitle,
    required this.coverAsset,
    required this.chapterNumber,
    required this.percent,
    required this.updatedAt,
  });

  final String seriesSlug;
  final String seriesTitle;
  final String coverAsset;
  final int chapterNumber;
  final int percent;
  final String updatedAt;
}

class WalletTransactionRecord {
  const WalletTransactionRecord({
    required this.id,
    required this.reference,
    required this.title,
    required this.provider,
    required this.coins,
    required this.amountTHB,
    required this.createdAt,
  });

  final String id;
  final String reference;
  final String title;
  final String provider;
  final int coins;
  final double amountTHB;
  final String createdAt;
}

class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.password,
    required this.pin,
    required this.role,
    required this.creatorStatus,
    required this.displayName,
    this.bio = '',
    this.avatarPath,
    this.avatarFrame = 'emerald',
    this.coinBalance = 0,
    this.freePassTickets = 3,
    this.plan = 'free',
    this.checkinDay = 0,
    this.lastCheckinDate = '',
    this.darkMode = false,
    List<String>? librarySlugs,
    List<String>? unlockedChapterIds,
    List<UnlockedChapterRecord>? unlockedChapters,
    List<ReadingHistoryRecord>? readingHistory,
    List<WalletTransactionRecord>? transactions,
  })  : librarySlugs = librarySlugs ?? <String>[],
        unlockedChapterIds = unlockedChapterIds ?? <String>[],
        unlockedChapters = unlockedChapters ?? <UnlockedChapterRecord>[],
        readingHistory = readingHistory ?? <ReadingHistoryRecord>[],
        transactions = transactions ?? <WalletTransactionRecord>[];

  final String id;
  final String email;
  String password;
  String pin;
  UserRole role;
  CreatorStatus creatorStatus;
  String displayName;
  String bio;
  String? avatarPath;
  String avatarFrame;
  int coinBalance;
  int freePassTickets;
  String plan;
  int checkinDay;
  String lastCheckinDate;
  bool darkMode;
  final List<String> librarySlugs;
  final List<String> unlockedChapterIds;
  final List<UnlockedChapterRecord> unlockedChapters;
  final List<ReadingHistoryRecord> readingHistory;
  final List<WalletTransactionRecord> transactions;

  double get totalTopupTHB =>
      transactions.fold<double>(0, (sum, tx) => sum + tx.amountTHB);

  int get totalTopupCoins =>
      transactions.where((tx) => tx.coins > 0).fold<int>(0, (s, tx) => s + tx.coins);
}

class ComicEpisode {
  const ComicEpisode({
    required this.id,
    required this.number,
    required this.title,
    required this.coinPrice,
    required this.publishedAt,
    required this.pageAssets,
  });

  final String id;
  final int number;
  final String title;
  final int coinPrice;
  final String publishedAt;
  final List<String> pageAssets;
}

class ComicComment {
  const ComicComment({
    required this.id,
    required this.seriesSlug,
    required this.chapterNumber,
    required this.authorName,
    required this.roleBadge,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String seriesSlug;
  final int chapterNumber;
  final String authorName;
  final String roleBadge;
  final String body;
  final String createdAt;
}

class ComicSeries {
  ComicSeries({
    required this.slug,
    required this.title,
    required this.author,
    required this.genreThai,
    required this.updateDay,
    required this.rating,
    required this.viewsCount,
    required this.coverAsset,
    required this.synopsis,
    required this.episodes,
    this.isCustomFileCover = false,
  });

  final String slug;
  final String title;
  final String author;
  final String genreThai;
  final String updateDay;
  final double rating;
  int viewsCount;
  final String coverAsset;
  final String synopsis;
  final List<ComicEpisode> episodes;
  final bool isCustomFileCover;
}

class CoinPackage {
  const CoinPackage({
    required this.id,
    required this.coins,
    required this.bonusCoins,
    required this.priceTHB,
    this.badge,
    this.title,
    this.isPlanUpgrade = false,
  });

  final String id;
  final int coins;
  final int bonusCoins;
  final int priceTHB;
  final String? badge;
  final String? title;
  final bool isPlanUpgrade;

  int get totalCoins => coins + bonusCoins;
  String get qrAsset => 'assets/qr/qr-$priceTHB.png';
}

class CreatorRequestModel {
  CreatorRequestModel({
    required this.id,
    required this.userId,
    required this.userEmail,
    required this.displayName,
    required this.penName,
    required this.sampleTitle,
    required this.synopsis,
    required this.coverAssetOrPath,
    required this.samplePages,
    this.isLocalFile = false,
    this.status = 'pending',
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String userEmail;
  final String displayName;
  final String penName;
  final String sampleTitle;
  final String synopsis;
  final String coverAssetOrPath;
  final List<String> samplePages;
  final bool isLocalFile;
  String status;
  final String createdAt;
}

class IssueReportModel {
  IssueReportModel({
    required this.id,
    required this.userEmail,
    required this.category,
    required this.subject,
    required this.description,
    this.status = 'open',
    this.adminReply,
    required this.createdAt,
  });

  final String id;
  final String userEmail;
  final String category;
  final String subject;
  final String description;
  String status;
  String? adminReply;
  final String createdAt;
}

class NotificationModel {
  NotificationModel({
    required this.id,
    required this.badge,
    required this.title,
    required this.message,
    required this.createdAt,
  });

  final String id;
  final String badge;
  final String title;
  final String message;
  final String createdAt;
}

class SystemLogModel {
  const SystemLogModel({
    required this.id,
    required this.level,
    required this.category,
    required this.message,
    required this.actorEmail,
    required this.createdAt,
  });

  final String id;
  final String level;
  final String category;
  final String message;
  final String actorEmail;
  final String createdAt;
}
