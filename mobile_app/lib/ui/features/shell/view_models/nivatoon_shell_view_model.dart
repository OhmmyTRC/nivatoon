import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'package:nivatoon_mobile/data/services/server_config_service.dart';

/// ViewModel managing the 1:1 Webtoon WebView session, automatic fallback to the embedded
/// GitHub Storage + Firebase DB Tailwind WebApp (`assets/webapp/index.html`), and Android file uploads.
class NivatoonShellViewModel extends ChangeNotifier {
  NivatoonShellViewModel({ServerConfigService? configService})
      : _configService = configService ?? ServerConfigService();

  final ServerConfigService _configService;
  WebViewController? _controller;
  WebViewController? get controller => _controller;

  String _activeUrl = ServerConfigService.presets.first.url;
  String get activeUrl => _activeUrl;

  bool _usingEmbeddedCloudApp = false;
  bool get usingEmbeddedCloudApp => _usingEmbeddedCloudApp;

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
            if ((error.isForMainFrame ?? true) && !_usingEmbeddedCloudApp) {
              // Automatically switch to the embedded 1:1 Tailwind WebApp (GitHub Storage + Firebase DB)
              loadEmbeddedCloudWebApp();
            }
          },
        ),
      );

    await _configureAndroidFileUpload(ctrl);
    _controller = ctrl;

    // Check if local/LAN Next.js server (localhost:3000 / 10.0.2.2:3000 / 192.168.0.20:3000) is reachable
    final saved = await _configService.loadSavedUrl();
    String? reachableServer;
    if (await _configService.checkReachable(saved)) {
      reachableServer = saved;
    } else {
      for (final preset in ServerConfigService.presets) {
        if (await _configService.checkReachable(preset.url)) {
          await _configService.saveUrl(preset.url);
          reachableServer = preset.url;
          break;
        }
      }
    }

    if (reachableServer != null) {
      _activeUrl = reachableServer;
      _usingEmbeddedCloudApp = false;
      await ctrl.loadRequest(Uri.parse(_activeUrl));
    } else {
      // Load the 1:1 Tailwind CSS WebApp powered directly by GitHub Storage & Firebase DB
      await loadEmbeddedCloudWebApp();
    }

    _initializing = false;
    notifyListeners();
  }

  /// Loads the bundled 1:1 Tailwind CSS WebApp (`assets/webapp/index.html`) that mirrors
  /// `http://localhost:3000/` and connects directly to GitHub (`OhmmyTRC/nivatoon`) & Firebase (`niva-421c2`).
  Future<void> loadEmbeddedCloudWebApp() async {
    _usingEmbeddedCloudApp = true;
    _hasLoadError = false;
    _errorDetail = null;
    _activeUrl = 'cloud://github-storage-firebase-db';
    notifyListeners();
    await _controller?.loadFlutterAsset('assets/webapp/index.html');
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
    if (_usingEmbeddedCloudApp) {
      await loadEmbeddedCloudWebApp();
    } else {
      await _controller?.reload();
    }
  }

  Future<void> switchServerUrl(String rawUrl) async {
    final clean = ServerConfigService.normalizeUrl(rawUrl);
    await _configService.saveUrl(clean);
    _activeUrl = clean;
    _usingEmbeddedCloudApp = false;
    _hasLoadError = false;
    _errorDetail = null;
    notifyListeners();
    if (await _configService.checkReachable(clean)) {
      await _controller?.loadRequest(Uri.parse(_activeUrl));
    } else {
      await loadEmbeddedCloudWebApp();
    }
  }
}
