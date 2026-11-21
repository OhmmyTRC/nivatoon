import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:nivatoon_mobile/domain/models/nivatoon_models.dart';

/// Official payment recipient constants and EMVCo Thai PromptPay QR payload generator.
class PromptPayService {
  static const String promptPayId = '1709700341765';
  static const String promptPayAccountName = 'ธีรชาติ เครือวัลย์';
  static const String trueMoneyId = '0997353282';
  static const String trueMoneyAccountName = 'ธีรชาติ เครือวัลย์';

  static const List<CoinPackage> coinPackages = <CoinPackage>[
    CoinPackage(id: 'pkg-100', coins: 100, bonusCoins: 0, priceTHB: 35),
    CoinPackage(id: 'pkg-250', coins: 250, bonusCoins: 15, priceTHB: 79),
    CoinPackage(
      id: 'pkg-550',
      coins: 550,
      bonusCoins: 50,
      priceTHB: 149,
      badge: 'ยอดนิยม',
    ),
    CoinPackage(id: 'pkg-1200', coins: 1200, bonusCoins: 150, priceTHB: 299),
    CoinPackage(
      id: 'pkg-2600',
      coins: 2600,
      bonusCoins: 400,
      priceTHB: 599,
      badge: 'คุ้มสุด',
    ),
    CoinPackage(id: 'pkg-6000', coins: 6000, bonusCoins: 1200, priceTHB: 1290),
  ];

  static const CoinPackage plusPackage = CoinPackage(
    id: 'plan-plus',
    coins: 300,
    bonusCoins: 0,
    priceTHB: 129,
    badge: 'NIVATOON PLUS',
    title: 'แพ็กเกจ NIVATOON PLUS รายเดือน (+300 เหรียญ + อ่านล่วงหน้าฟรี)',
    isPlanUpgrade: true,
  );

  static CoinPackage findPackageById(String id) {
    if (id == plusPackage.id) return plusPackage;
    for (final pkg in coinPackages) {
      if (pkg.id == id) return pkg;
    }
    return coinPackages.first;
  }

  static String _tlv(String tag, String value) {
    final len = value.length.toString().padLeft(2, '0');
    return '$tag$len$value';
  }

  static String _crc16Ccitt(String payload) {
    int crc = 0xFFFF;
    for (int i = 0; i < payload.length; i++) {
      crc ^= (payload.codeUnitAt(i) << 8);
      for (int j = 0; j < 8; j++) {
        if ((crc & 0x8000) != 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
  }

  /// Generates an EMVCo-compliant Thai PromptPay QR payload for the exact `amountTHB`.
  static String buildPromptPayPayload(
    int amountTHB, {
    String recipientId = promptPayId,
  }) {
    final digits = recipientId.replaceAll(RegExp(r'\D'), '');
    final String targetTag;
    if (digits.length == 13) {
      targetTag = _tlv('02', digits);
    } else if (digits.length == 10 && digits.startsWith('0')) {
      targetTag = _tlv('01', '0066${digits.substring(1)}');
    } else {
      targetTag = _tlv('03', digits);
    }

    final merchantInfo = _tlv('00', 'A000000677010111') + targetTag;
    final hasAmount = amountTHB > 0;
    final parts = <String>[
      _tlv('00', '01'),
      _tlv('01', hasAmount ? '12' : '11'),
      _tlv('29', merchantInfo),
      _tlv('53', '764'),
      if (hasAmount) _tlv('54', amountTHB.toStringAsFixed(2)),
      _tlv('58', 'TH'),
      '6304',
    ].join();

    return parts + _crc16Ccitt(parts);
  }

  /// Computes a SHA-256 hash and deterministic slip reference from an uploaded image file.
  static Future<({String slipHash, String reference, int byteLength})>
      inspectSlipFile(String filePath) async {
    final file = File(filePath);
    final bytes = await file.exists()
        ? await file.readAsBytes()
        : utf8.encode(filePath);
    final digest = sha256.convert(bytes).toString();
    final ref = 'SLIP-${digest.substring(0, 10).toUpperCase()}';
    return (slipHash: digest, reference: ref, byteLength: bytes.length);
  }
}
