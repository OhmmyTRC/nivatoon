import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:nivatoon_mobile/data/services/server_config_service.dart';
import 'package:nivatoon_mobile/ui/features/shell/view_models/nivatoon_shell_view_model.dart';

/// Main NIVATOON Android container hosting the 1:1 responsive web app (`http://localhost:3000/`
/// or embedded GitHub Storage + Firebase DB Tailwind WebApp).
class NivatoonShellView extends StatefulWidget {
  const NivatoonShellView({super.key, this.viewModel, this.onSwitchToNative});

  final NivatoonShellViewModel? viewModel;
  final VoidCallback? onSwitchToNative;

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
    final textCtrl = TextEditingController(
      text: _vm.usingEmbeddedCloudApp
          ? ServerConfigService.presets.first.url
          : _vm.activeUrl,
    );
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
                    Icon(Icons.cloud_done_rounded, color: Color(0xFF00A84B)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'โหมดแสดงผล NIVATOON (1:1 Web UI & Cloud)',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _vm.usingEmbeddedCloudApp
                      ? 'สถานะปัจจุบัน: โหมด 1:1 Cloud Web UI (GitHub Storage OhmmyTRC/nivatoon + Firebase DB niva-421c2)'
                      : 'สถานะปัจจุบัน: เชื่อมต่อเซิร์ฟเวอร์สด (${_vm.activeUrl})',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _vm.loadEmbeddedCloudWebApp();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF18181B),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.cloud_queue_rounded, color: Color(0xFF00DC64)),
                  label: const Text(
                    'ใช้โหมด 1:1 Cloud Web UI (GitHub + Firebase ไม่ต้องเปิดคอมฯ)',
                    style: TextStyle(
                      color: Color(0xFF00DC64),
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: textCtrl,
                  keyboardType: TextInputType.url,
                  decoration: InputDecoration(
                    labelText: 'หรือเชื่อมต่อ Server URL (เช่น http://192.168.0.20:3000)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
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
                        label: const Text('รีเฟรชหน้าจอ'),
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
                          'เชื่อมต่อ URL นี้',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                ),
                if (widget.onSwitchToNative != null) ...<Widget>[
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      widget.onSwitchToNative?.call();
                    },
                    icon: const Icon(Icons.phone_android_rounded, size: 16),
                    label: const Text('สลับไปโหมด Native Dart UI สำรอง'),
                  ),
                ],
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
                    bottom: 74,
                    child: Opacity(
                      opacity: 0.78,
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
                              Icons.cloud_sync_rounded,
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
            'กำลังโหลด NIVATOON...',
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
