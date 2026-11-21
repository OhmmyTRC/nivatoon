import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';

/// Mandatory Login / Register / 6-Digit OTP Forgot Password screen (#1, #2, #9).
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  String _mode = 'login'; // login | register | forgot
  String _forgotStep = 'email'; // email | verify
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  final TextEditingController _pinCtrl = TextEditingController(text: '123456');
  final TextEditingController _otpCtrl = TextEditingController();
  final TextEditingController _newPassCtrl = TextEditingController();

  String? _error;
  String? _info;
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _pinCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    super.dispose();
  }

  void _quickFill(String email, String pass) {
    setState(() {
      _mode = 'login';
      _emailCtrl.text = email;
      _passCtrl.text = pass;
      _error = null;
      _info = null;
    });
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _info = null;
    });

    if (_mode == 'login') {
      final res = widget.repo.login(_emailCtrl.text, _passCtrl.text);
      if (!res.ok) {
        setState(() => _error = res.message);
      }
      return;
    }

    if (_mode == 'register') {
      final res = widget.repo.register(
        displayName: _nameCtrl.text,
        email: _emailCtrl.text,
        password: _passCtrl.text,
        pin: _pinCtrl.text,
      );
      if (!res.ok) {
        setState(() => _error = res.message);
      }
      return;
    }

    if (_mode == 'forgot') {
      if (_forgotStep == 'email') {
        setState(() => _loading = true);
        final res = await widget.repo.requestPasswordResetOtp(_emailCtrl.text);
        if (!mounted) return;
        setState(() {
          _loading = false;
          if (!res.ok) {
            _error = res.message;
          } else {
            _info = res.message;
            if (res.generatedOtp != null) {
              _otpCtrl.text = res.generatedOtp!;
            }
            _forgotStep = 'verify';
          }
        });
      } else {
        final res = widget.repo.confirmPasswordResetOtp(
          email: _emailCtrl.text,
          code: _otpCtrl.text,
          newPassword: _newPassCtrl.text,
        );
        if (!res.ok) {
          setState(() => _error = res.message);
        } else {
          setState(() {
            _info = res.message;
            _mode = 'login';
            _forgotStep = 'email';
            _passCtrl.text = _newPassCtrl.text;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xFF00DC64),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            alignment: Alignment.center,
                            child: const Text(
                              'N',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'NIVATOON',
                              style: TextStyle(
                                fontSize: 21,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: const Text(
                              'สมาชิกเท่านั้น',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF008F42),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (_mode != 'forgot')
                        SegmentedButton<String>(
                          segments: const <ButtonSegment<String>>[
                            ButtonSegment<String>(
                              value: 'login',
                              label: Text('เข้าสู่ระบบ'),
                            ),
                            ButtonSegment<String>(
                              value: 'register',
                              label: Text('สมัครสมาชิก'),
                            ),
                          ],
                          selected: <String>{_mode},
                          onSelectionChanged: (Set<String> s) {
                            setState(() {
                              _mode = s.first;
                              _error = null;
                              _info = null;
                            });
                          },
                        ),
                      const SizedBox(height: 14),
                      Text(
                        _mode == 'forgot'
                            ? 'กู้คืนรหัสผ่านด้วย CODE 6 หลัก'
                            : _mode == 'register'
                                ? 'สมัครฟรี! เริ่มต้น 0 เหรียญ + ตั๋วอ่านฟรี 3 ใบ'
                                : 'เข้าสู่ระบบก่อนอ่านมังฮวา',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_error != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFE4E6),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFBE123C),
                            ),
                          ),
                        ),
                      if (_info != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _info!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF006E33),
                            ),
                          ),
                        ),
                      if (_mode == 'register') ...<Widget>[
                        TextField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'ชื่อที่แสดง',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      TextField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'อีเมล',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (_mode != 'forgot') ...<Widget>[
                        TextField(
                          controller: _passCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'รหัสผ่าน',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (_mode == 'register') ...<Widget>[
                        TextField(
                          controller: _pinCtrl,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          decoration: const InputDecoration(
                            labelText: 'ตั้งรหัส PIN ความปลอดภัย 6 หลัก',
                            border: OutlineInputBorder(),
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (_mode == 'forgot' && _forgotStep == 'verify') ...<Widget>[
                        TextField(
                          controller: _otpCtrl,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          decoration: const InputDecoration(
                            labelText: 'CODE 6 หลักจากอีเมล',
                            border: OutlineInputBorder(),
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _newPassCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      FilledButton(
                        onPressed: _loading ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF00DC64),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: Text(
                          _loading
                              ? 'กำลังดำเนินการ...'
                              : _mode == 'forgot'
                                  ? (_forgotStep == 'email'
                                      ? 'ส่ง CODE 6 หลักไปยังอีเมล'
                                      : 'ยืนยัน CODE และตั้งรหัสผ่านใหม่')
                                  : (_mode == 'register'
                                      ? 'สมัครสมาชิก (รับ 3 ตั๋วฟรี)'
                                      : 'เข้าสู่ระบบ'),
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () {
                          setState(() {
                            if (_mode == 'forgot') {
                              _mode = 'login';
                              _forgotStep = 'email';
                            } else {
                              _mode = 'forgot';
                              _forgotStep = 'email';
                            }
                            _error = null;
                            _info = null;
                          });
                        },
                        child: Text(
                          _mode == 'forgot'
                              ? '← กลับไปหน้าเข้าสู่ระบบ'
                              : 'ลืมรหัสผ่าน / รับ CODE 6 หลักทางอีเมล?',
                        ),
                      ),
                      if (_mode != 'forgot') ...<Widget>[
                        const Divider(height: 20),
                        const Text(
                          'ทดสอบแยกยศ 3 ระดับ (1 แตะ • PIN เริ่มต้น 123456):',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.black54,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: <Widget>[
                            ActionChip(
                              label: const Text('👤 User'),
                              onPressed: () =>
                                  _quickFill('reader@gmail.com', 'Reader2026!'),
                            ),
                            ActionChip(
                              label: const Text('🎨 Creator'),
                              onPressed: () =>
                                  _quickFill('creator@nivatoon.app', 'Creator2026!'),
                            ),
                            ActionChip(
                              label: const Text('🛡️ Admin'),
                              onPressed: () =>
                                  _quickFill('admin@nivatoon.app', 'NivaAdmin2026!'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 6-Digit PIN Security Gate after login, with Password-verified PIN reset (#6).
class PinSecurityGateScreen extends StatefulWidget {
  const PinSecurityGateScreen({super.key, required this.repo});

  final NivatoonRepository repo;

  @override
  State<PinSecurityGateScreen> createState() => _PinSecurityGateScreenState();
}

class _PinSecurityGateScreenState extends State<PinSecurityGateScreen> {
  String _digits = '';
  String? _error;
  bool _showResetBox = false;
  final TextEditingController _passCtrl = TextEditingController();
  final TextEditingController _newPinCtrl = TextEditingController();

  @override
  void dispose() {
    _passCtrl.dispose();
    _newPinCtrl.dispose();
    super.dispose();
  }

  void _tapDigit(String d) {
    if (_digits.length >= 6) return;
    final next = '$_digits$d';
    setState(() {
      _digits = next;
      _error = null;
    });
    if (next.length == 6) {
      final ok = widget.repo.verifyPin(next);
      if (!ok) {
        setState(() {
          _digits = '';
          _error = 'รหัส PIN 6 หลักไม่ถูกต้อง (ค่าเริ่มต้นบัญชีทดสอบคือ 123456)';
        });
      }
    }
  }

  void _resetPinWithPass() {
    final res = widget.repo.changePin(
      currentPassword: _passCtrl.text,
      newPin: _newPinCtrl.text,
    );
    if (!res.ok) {
      setState(() => _error = res.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.repo.currentUser;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          const Text(
                            'ยืนยันความปลอดภัย PIN 6 หลัก',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF00A84B),
                            ),
                          ),
                          TextButton(
                            onPressed: widget.repo.logout,
                            child: const Text('เปลี่ยนบัญชี'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: const Color(0xFF18181B),
                        child: Text(
                          (user?.displayName.isNotEmpty ?? false)
                              ? user!.displayName[0].toUpperCase()
                              : 'N',
                          style: const TextStyle(
                            color: Color(0xFF00DC64),
                            fontWeight: FontWeight.w900,
                            fontSize: 22,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        user?.displayName ?? '',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List<Widget>.generate(6, (int i) {
                          final filled = i < _digits.length;
                          return Container(
                            width: 14,
                            height: 14,
                            margin: const EdgeInsets.symmetric(horizontal: 6),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: filled
                                  ? const Color(0xFF00DC64)
                                  : Colors.transparent,
                              border: Border.all(
                                color: filled
                                    ? const Color(0xFF00DC64)
                                    : Colors.black26,
                                width: 2,
                              ),
                            ),
                          );
                        }),
                      ),
                      if (_error != null) ...<Widget>[
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFFBE123C),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        childAspectRatio: 1.7,
                        children: <Widget>[
                          for (final d in <String>[
                            '1',
                            '2',
                            '3',
                            '4',
                            '5',
                            '6',
                            '7',
                            '8',
                            '9',
                          ])
                            FilledButton.tonal(
                              onPressed: () => _tapDigit(d),
                              child: Text(
                                d,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          OutlinedButton(
                            onPressed: () => setState(() => _digits = ''),
                            child: const Text('ล้าง'),
                          ),
                          FilledButton.tonal(
                            onPressed: () => _tapDigit('0'),
                            child: const Text(
                              '0',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          OutlinedButton(
                            onPressed: () {
                              if (_digits.isNotEmpty) {
                                setState(() {
                                  _digits = _digits.substring(0, _digits.length - 1);
                                });
                              }
                            },
                            child: const Icon(Icons.backspace_outlined, size: 18),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TextButton(
                        onPressed: () =>
                            setState(() => _showResetBox = !_showResetBox),
                        child: Text(
                          _showResetBox
                              ? 'ปิดฟอร์มเปลี่ยน PIN'
                              : 'ลืมรหัส PIN หรือต้องการเปลี่ยน PIN ใหม่?',
                        ),
                      ),
                      if (_showResetBox) ...<Widget>[
                        TextField(
                          controller: _passCtrl,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'ยืนยันรหัสผ่านบัญชี',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _newPinCtrl,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          decoration: const InputDecoration(
                            labelText: 'รหัส PIN ใหม่ 6 หลัก',
                            border: OutlineInputBorder(),
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _resetPinWithPass,
                            child: const Text('ยืนยันตั้ง PIN 6 หลักใหม่'),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
