import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'package:nivatoon_mobile/data/services/server_config_service.dart';

/// ViewModel managing the WebView session, Android file uploads, and server routing.
class NivatoonShellViewModel extends ChangeNotifier {
  NivatoonShellViewModel({ServerConfigService? configService})
      : _configService = configService ?? ServerConfigService();

  final ServerConfigService _configService;
  WebViewController? _controller;
  WebViewController? get controller => _controller;

  String _activeUrl = ServerConfigService.presets.first.url;
  String get activeUrl => _activeUrl;

  int _progress = 0;
  int get progress => _progress;

  bool _initializing = true;
  bool get initializing => _initializing;

  bool _hasLoadError = false;
  bool get hasLoadError => _hasLoadError;

  String? _errorDetail;
  String? get errorDetail => _errorDetail;

  Future<void> initialize() async {
    _initializing = true;
    _hasLoadError = false;
    _errorDetail = null;
    notifyListeners();

    final resolved = await _configService.resolveBestUrl();
    _activeUrl = resolved;

    final ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFFFF))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int p) {
            _progress = p;
            notifyListeners();
          },
          onPageStarted: (String url) {
            _hasLoadError = false;
            _errorDetail = null;
            notifyListeners();
          },
          onPageFinished: (String url) {
            _progress = 100;
            notifyListeners();
          },
          onWebResourceError: (WebResourceError error) {
            if (error.isForMainFrame ?? true) {
              _hasLoadError = true;
              _errorDetail = '${error.description} (${error.errorCode})';
              notifyListeners();
            }
          },
        ),
      );

    await _configureAndroidFileUpload(ctrl);
    _controller = ctrl;

    await ctrl.loadRequest(Uri.parse(_activeUrl));
    _initializing = false;
    notifyListeners();
  }

  /// Wires Android `<input type="file">` (payment slip, avatar, creator artwork)
  /// to the native Android file/photo picker.
  Future<void> _configureAndroidFileUpload(WebViewController ctrl) async {
    final platformController = ctrl.platform;
    if (platformController is AndroidWebViewController) {
      await platformController.setMediaPlaybackRequiresUserGesture(false);
      await platformController.setOnShowFileSelector(
        (FileSelectorParams params) async {
          final wantsImage =
              params.acceptTypes.any((t) => t.toLowerCase().contains('image'));
          final fileType = wantsImage ? FileType.image : FileType.any;

          if (params.mode == FileSelectorMode.openMultiple) {
            final files = await FilePicker.pickFiles(type: fileType);
            return files
                .map((f) => f.path)
                .whereType<String>()
                .map((p) => Uri.file(p).toString())
                .toList();
          }

          final picked = await FilePicker.pickFile(type: fileType);
          final path = picked?.path;
          if (path == null || path.isEmpty || !File(path).existsSync()) {
            return <String>[];
          }
          return <String>[Uri.file(path).toString()];
        },
      );
    }
  }

  Future<bool> handleBackPressed() async {
    final ctrl = _controller;
    if (ctrl != null && await ctrl.canGoBack()) {
      await ctrl.goBack();
      return false;
    }
    return true;
  }

  Future<void> reload() async {
    _hasLoadError = false;
    _errorDetail = null;
    notifyListeners();
    await _controller?.reload();
  }

  Future<void> switchServerUrl(String rawUrl) async {
    final clean = ServerConfigService.normalizeUrl(rawUrl);
    await _configService.saveUrl(clean);
    _activeUrl = clean;
    _hasLoadError = false;
    _errorDetail = null;
    notifyListeners();
    await _controller?.loadRequest(Uri.parse(_activeUrl));
  }
}
