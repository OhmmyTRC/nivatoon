import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:nivatoon_mobile/data/services/server_config_service.dart';
import 'package:nivatoon_mobile/ui/features/shell/view_models/nivatoon_shell_view_model.dart';

/// Main NIVATOON Android container hosting the responsive web app + server tools.
class NivatoonShellView extends StatefulWidget {
  const NivatoonShellView({super.key, this.viewModel});

  final NivatoonShellViewModel? viewModel;

  @override
  State<NivatoonShellView> createState() => _NivatoonShellViewState();
}

class _NivatoonShellViewState extends State<NivatoonShellView> {
  late final NivatoonShellViewModel _vm;
  DateTime? _lastBackAt;

  @override
  void initState() {
    super.initState();
    _vm = widget.viewModel ?? NivatoonShellViewModel();
    _vm.initialize();
  }

  @override
  void dispose() {
    if (widget.viewModel == null) {
      _vm.dispose();
    }
    super.dispose();
  }

  Future<void> _openServerSettingsSheet() async {
    final textCtrl = TextEditingController(text: _vm.activeUrl);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.viewInsetsOf(ctx).bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Row(
                  children: <Widget>[
                    Icon(Icons.dns_rounded, color: Color(0xFF00A84B)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'ตั้งค่าที่อยู่เซิร์ฟเวอร์ NIVATOON',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'ปัจจุบัน: ${_vm.activeUrl}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: textCtrl,
                  keyboardType: TextInputType.url,
                  decoration: InputDecoration(
                    labelText: 'Server URL (เช่น http://192.168.0.20:3000 หรือ HTTPS)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'เลือกด่วน:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                ...ServerConfigService.presets.map(
                  (preset) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        _vm.switchServerUrl(preset.url);
                      },
                      style: OutlinedButton.styleFrom(
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            preset.label,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                          ),
                          Text(
                            '${preset.url} • ${preset.description}',
                            style: const TextStyle(fontSize: 11, color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          _vm.reload();
                        },
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('รีเฟรชหน้าเว็บ'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          _vm.switchServerUrl(textCtrl.text);
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF00DC64),
                        ),
                        child: const Text(
                          'บันทึกและเชื่อมต่อ',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (didPop) return;
        final messenger = ScaffoldMessenger.of(context);
        final atRoot = await _vm.handleBackPressed();
        if (!atRoot || !mounted) return;

        final now = DateTime.now();
        if (_lastBackAt == null ||
            now.difference(_lastBackAt!) > const Duration(seconds: 2)) {
          _lastBackAt = now;
          messenger.showSnackBar(
            const SnackBar(
              content: Text('กดย้อนกลับอีกครั้งเพื่อออกจาก NIVATOON'),
              duration: Duration(seconds: 2),
            ),
          );
          return;
        }
        await SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: ListenableBuilder(
            listenable: _vm,
            builder: (BuildContext context, _) {
              final ctrl = _vm.controller;
              return Stack(
                children: <Widget>[
                  if (_vm.initializing || ctrl == null)
                    const _BootScreen()
                  else if (_vm.hasLoadError)
                    _ConnectionErrorView(
                      url: _vm.activeUrl,
                      detail: _vm.errorDetail,
                      onRetry: _vm.reload,
                      onOpenSettings: _openServerSettingsSheet,
                    )
                  else
                    WebViewWidget(controller: ctrl),
                  if (_vm.progress > 0 && _vm.progress < 100)
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: LinearProgressIndicator(
                        value: _vm.progress / 100.0,
                        minHeight: 3,
                        color: const Color(0xFF00DC64),
                        backgroundColor: Colors.transparent,
                      ),
                    ),
                  Positioned(
                    right: 10,
                    bottom: 86,
                    child: Opacity(
                      opacity: 0.72,
                      child: Material(
                        color: const Color(0xFF09090B),
                        shape: const CircleBorder(),
                        elevation: 4,
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _openServerSettingsSheet,
                          child: const Padding(
                            padding: EdgeInsets.all(8),
                            child: Icon(
                              Icons.settings_ethernet_rounded,
                              size: 18,
                              color: Color(0xFF00DC64),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          DecoratedBox(
            decoration: BoxDecoration(
              color: Color(0xFF00DC64),
              borderRadius: BorderRadius.all(Radius.circular(18)),
            ),
            child: SizedBox(
              width: 72,
              height: 72,
              child: Center(
                child: Text(
                  'N',
                  style: TextStyle(
                    fontSize: 38,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: 16),
          Text(
            'กำลังเชื่อมต่อ NIVATOON...',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          SizedBox(height: 12),
          SizedBox(
            width: 140,
            child: LinearProgressIndicator(color: Color(0xFF00DC64)),
          ),
        ],
      ),
    );
  }
}

class _ConnectionErrorView extends StatelessWidget {
  const _ConnectionErrorView({
    required this.url,
    required this.detail,
    required this.onRetry,
    required this.onOpenSettings,
  });

  final String url;
  final String? detail;
  final VoidCallback onRetry;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.wifi_off_rounded, size: 56, color: Color(0xFF00A84B)),
            const SizedBox(height: 14),
            const Text(
              'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ NIVATOON ได้',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              'ปลายทางปัจจุบัน: $url\n'
              'หากใช้มือถือจริง ให้ต่อ Wi-Fi วงเดียวกับคอมพิวเตอร์ (192.168.0.20:3000) '
              'หรือเสียบสาย USB แล้วรัน adb reverse tcp:3000 tcp:3000',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Colors.black54, height: 1.5),
            ),
            if (detail != null && detail!.isNotEmpty) ...<Widget>[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  detail!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11, color: Color(0xFFBE123C)),
                ),
              ),
            ],
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: <Widget>[
                FilledButton.icon(
                  onPressed: onRetry,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF00DC64),
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text(
                    'ลองเชื่อมต่อใหม่',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onOpenSettings,
                  icon: const Icon(Icons.tune_rounded),
                  label: const Text(
                    'เปลี่ยนที่อยู่ Server URL',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
