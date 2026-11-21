import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/data/services/cloud_storage_and_db_service.dart';
import 'package:nivatoon_mobile/data/services/promptpay_service.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';

/// Renders images from GitHub Raw Storage (`https://raw.githubusercontent.com/OhmmyTRC/nivatoon/main/public/...`),
/// bundled assets (`assets/...`), or local gallery files (`File`).
class AdaptiveComicImage extends StatelessWidget {
  const AdaptiveComicImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius = 0,
    this.fallbackAsset,
  });

  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double borderRadius;
  final String? fallbackAsset;

  @override
  Widget build(BuildContext context) {
    final resolved = CloudStorageAndDbService.toGitHubRawUrl(path);
    final isNetwork =
        resolved.startsWith('https://') || resolved.startsWith('http://');
    final isAsset = resolved.startsWith('assets/');

    final Widget img;
    if (isNetwork) {
      img = Image.network(
        resolved,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (BuildContext ctx, Widget child, ImageChunkEvent? p) {
          if (p == null) return child;
          return Container(
            width: width,
            height: height ?? 180,
            color: const Color(0xFF18181B),
            alignment: Alignment.center,
            child: const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                color: Color(0xFF00DC64),
              ),
            ),
          );
        },
        errorBuilder: (_, _, _) => _fallbackOrPlaceholder(),
      );
    } else if (isAsset) {
      img = Image.asset(
        resolved,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) => _placeholder(),
      );
    } else {
      img = Image.file(
        File(resolved),
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) => _fallbackOrPlaceholder(),
      );
    }

    if (borderRadius <= 0) return img;
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: img,
    );
  }

  Widget _fallbackOrPlaceholder() {
    if (fallbackAsset != null && fallbackAsset!.startsWith('assets/')) {
      return Image.asset(
        fallbackAsset!,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) => _placeholder(),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return Container(
      width: width,
      height: height ?? 160,
      color: const Color(0xFF18181B),
      alignment: Alignment.center,
      child: const Icon(Icons.menu_book_rounded, color: Color(0xFF00DC64)),
    );
  }
}

/// Upgraded Metallic Gold Coin Badge Icon (#5).
class CoinBadgeIcon extends StatelessWidget {
  const CoinBadgeIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFFFFE066), Color(0xFFF59E0B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFFB45309), width: 1.4),
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0x33F59E0B), blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        'C',
        style: TextStyle(
          fontSize: size * 0.56,
          fontWeight: FontWeight.w900,
          color: const Color(0xFF78350F),
          height: 1,
        ),
      ),
    );
  }
}

/// Emerald Free Reading Ticket Badge Icon (#12).
class TicketBadgeIcon extends StatelessWidget {
  const TicketBadgeIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFF00DC64),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      alignment: Alignment.center,
      child: Icon(
        Icons.confirmation_number_rounded,
        size: size * 0.68,
        color: Colors.white,
      ),
    );
  }
}

/// Opens the Notifications & Promotions dialog and clears the unread badge count (#2, #15).
Future<void> showNotificationsDialog(
  BuildContext context,
  NivatoonRepository repo,
) async {
  repo.markAllNotificationsRead();
  await showDialog<void>(
    context: context,
    builder: (BuildContext ctx) {
      return AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: const Row(
          children: <Widget>[
            Icon(Icons.notifications_active_rounded, color: Color(0xFF00DC64)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'แจ้งเตือน & โปรโมชั่น',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 360,
          child: repo.notifications.isEmpty
              ? const Text('ยังไม่มีการแจ้งเตือนใหม่')
              : ListView.separated(
                  shrinkWrap: true,
                  itemCount: repo.notifications.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, int i) {
                    final n = repo.notifications[i];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.black12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF00DC64),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  n.badge,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Text(
                                'อ่านแล้ว ✓',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF00A84B),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            n.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            n.message,
                            style: const TextStyle(fontSize: 12, height: 1.4),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('ปิดหน้าต่าง'),
          ),
        ],
      );
    },
  );
}

/// Realistic PromptPay / TrueMoney Slip Payment Bottom Sheet (#3, #6).
Future<void> showRealPaymentSheet(
  BuildContext context, {
  required NivatoonRepository repo,
  required CoinPackage package,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (BuildContext ctx) {
      return _RealPaymentSheetBody(repo: repo, initialPackage: package);
    },
  );
}

class _RealPaymentSheetBody extends StatefulWidget {
  const _RealPaymentSheetBody({
    required this.repo,
    required this.initialPackage,
  });

  final NivatoonRepository repo;
  final CoinPackage initialPackage;

  @override
  State<_RealPaymentSheetBody> createState() => _RealPaymentSheetBodyState();
}

class _RealPaymentSheetBodyState extends State<_RealPaymentSheetBody> {
  late CoinPackage _pkg;
  String _provider = 'promptpay';
  String? _slipPath;
  String _autoRef = '';
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _pkg = widget.initialPackage;
  }

  Future<void> _pickSlipImage() async {
    final picked = await FilePicker.pickFile(type: FileType.image);
    final path = picked?.path;
    if (path == null || path.isEmpty) return;
    final info = await PromptPayService.inspectSlipFile(path);
    if (!mounted) return;
    setState(() {
      _slipPath = path;
      _autoRef = info.reference;
    });
  }

  Future<void> _submitVerify() async {
    if (_slipPath == null) return;
    setState(() => _verifying = true);
    final res = await widget.repo.verifySlipAndCredit(
      package: _pkg,
      provider: _provider,
      slipFilePath: _slipPath!,
    );
    if (!mounted) return;
    setState(() => _verifying = false);

    await showDialog<void>(
      context: context,
      builder: (BuildContext dCtx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: res.ok ? const Color(0xFFDCFCE7) : const Color(0xFFFFE4E6),
                ),
                alignment: Alignment.center,
                child: Icon(
                  res.ok ? Icons.verified_rounded : Icons.error_outline_rounded,
                  size: 40,
                  color: res.ok ? const Color(0xFF00A84B) : const Color(0xFFE11D48),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                res.title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                res.message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, height: 1.45),
              ),
              if (res.reference.isNotEmpty) ...<Widget>[
                const SizedBox(height: 10),
                Text(
                  'เลขอ้างอิง: ${res.reference}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.black54,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(dCtx).pop();
                    if (res.ok) {
                      Navigator.of(context).pop();
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        res.ok ? const Color(0xFF00DC64) : const Color(0xFF18181B),
                  ),
                  child: Text(
                    res.ok ? 'เสร็จสิ้น ✓' : 'ลองอัปโหลดสลิปใหม่อีกครั้ง',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 22,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    _pkg.isPlanUpgrade
                        ? 'สมัครแพ็กเกจ NIVATOON PLUS (฿${_pkg.priceTHB})'
                        : 'ชำระเงินเติม ${_pkg.totalCoins} เหรียญ (฿${_pkg.priceTHB})',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            if (!_pkg.isPlanUpgrade) ...<Widget>[
              const SizedBox(height: 6),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: PromptPayService.coinPackages.map((p) {
                    final selected = p.id == _pkg.id;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text('฿${p.priceTHB} (${p.totalCoins})'),
                        selected: selected,
                        onSelected: (_) => setState(() => _pkg = p),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const <ButtonSegment<String>>[
                ButtonSegment<String>(
                  value: 'promptpay',
                  label: Text('พร้อมเพย์ QR'),
                  icon: Icon(Icons.qr_code_2_rounded),
                ),
                ButtonSegment<String>(
                  value: 'truemoney',
                  label: Text('TrueMoney Wallet'),
                  icon: Icon(Icons.account_balance_wallet_rounded),
                ),
              ],
              selected: <String>{_provider},
              onSelectionChanged: (Set<String> s) =>
                  setState(() => _provider = s.first),
            ),
            const SizedBox(height: 14),
            if (_provider == 'promptpay')
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.black12),
                ),
                child: Column(
                  children: <Widget>[
                    const Text(
                      'THAI QR PROMPTPAY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF113566),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '฿${_pkg.priceTHB}.00',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF00A84B),
                      ),
                    ),
                    Text(
                      'พร้อมเพย์: ${PromptPayService.promptPayId}\nชื่อบัญชี: ${PromptPayService.promptPayAccountName}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    AdaptiveComicImage(
                      path: _pkg.qrAsset,
                      width: 185,
                      height: 185,
                      fit: BoxFit.contain,
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6600),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'โอนเข้า TrueMoney Wallet',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      PromptPayService.trueMoneyId,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 24,
                      ),
                    ),
                    const Text(
                      'ชื่อบัญชี: ${PromptPayService.trueMoneyAccountName}',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      'ยอดชำระ: ฿${_pkg.priceTHB}.00',
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _pickSlipImage,
              icon: const Icon(Icons.upload_file_rounded),
              label: Text(
                _slipPath == null
                    ? '1. เลือกรูปสลิปโอนเงินจากเครื่อง (จำเป็น)'
                    : 'เปลี่ยนรูปสลิป (${_slipPath!.split(RegExp(r'[/\\]')).last})',
              ),
            ),
            if (_autoRef.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '✓ สแกนเลขอ้างอิงสลิปอัตโนมัติ: $_autoRef',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF008F42),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: (_slipPath == null || _verifying) ? null : _submitVerify,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF00DC64),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(
                _verifying
                    ? 'กำลังตรวจสอบยอดโอนจริง...'
                    : 'ยืนยันชำระเงิน ฿${_pkg.priceTHB}.00 และรับสิทธิ์',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
