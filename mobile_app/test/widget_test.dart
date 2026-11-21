import 'package:flutter_test/flutter_test.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/data/services/promptpay_service.dart';
import 'package:nivatoon_mobile/data/services/server_config_service.dart';
import 'package:nivatoon_mobile/main.dart';

void main() {
  test('ServerConfigService & PromptPayService 35 THB QR payload', () {
    expect(
      ServerConfigService.normalizeUrl('192.168.0.20:3000/'),
      'http://192.168.0.20:3000',
    );
    final payload35 = PromptPayService.buildPromptPayPayload(35);
    expect(payload35.contains('540535.00'), isTrue);
    expect(payload35.contains('149.00'), isFalse);
  });

  test('NivatoonRepository enforces 0 coins, 3 free tickets, 7-day check-in & PIN change', () {
    final repo = NivatoonRepository();
    final reg = repo.register(
      displayName: 'New Reader',
      email: 'newreader@gmail.com',
      password: 'Password123!',
      pin: '112233',
    );
    expect(reg.ok, isTrue);
    expect(repo.currentUser?.coinBalance, 0);
    expect(repo.currentUser?.freePassTickets, 3);
    expect(repo.isPinUnlocked, isFalse);

    expect(repo.verifyPin('999999'), isFalse);
    expect(repo.verifyPin('112233'), isTrue);
    expect(repo.isPinUnlocked, isTrue);

    // Notifications unread count clears to 0 when marked read
    expect(repo.unreadNotificationCount, greaterThan(0));
    repo.markAllNotificationsRead();
    expect(repo.unreadNotificationCount, 0);

    // Daily check-in Day 1 -> +1 ticket (3 -> 4)
    final chk = repo.claimDailyCheckin();
    expect(chk.ok, isTrue);
    expect(chk.rewardTickets, 1);
    expect(repo.currentUser?.freePassTickets, 4);

    // Change PIN
    final pinRes = repo.changePin(currentPin: '112233', newPin: '654321');
    expect(pinRes.ok, isTrue);
    repo.lockPinGate();
    expect(repo.verifyPin('112233'), isFalse);
    expect(repo.verifyPin('654321'), isTrue);
  });

  testWidgets('NivatoonApp boots to mandatory AuthScreen before login', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const NivatoonApp());
    expect(find.text('NIVATOON'), findsOneWidget);
    expect(find.text('สมาชิกเท่านั้น'), findsOneWidget);
  });
}
