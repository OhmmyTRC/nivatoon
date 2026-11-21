import 'package:material_ui/material_ui.dart';
import 'package:nivatoon_mobile/data/repositories/nivatoon_repository.dart';
import 'package:nivatoon_mobile/ui/features/auth/auth_and_pin_screens.dart';
import 'package:nivatoon_mobile/ui/features/home/home_and_reader_screens.dart';
import 'package:nivatoon_mobile/ui/features/shell/views/nivatoon_shell_view.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    NivatoonApp(
      repository: NivatoonRepository(autoCloudSync: true),
    ),
  );
}

/// Root widget for the NIVATOON Android application
/// (1:1 Webtoon UI + GitHub File Storage `OhmmyTRC/nivatoon` + Firebase Cloud Database `niva-421c2`).
class NivatoonApp extends StatefulWidget {
  const NivatoonApp({super.key, this.home, this.repository});

  final Widget? home;
  final NivatoonRepository? repository;

  @override
  State<NivatoonApp> createState() => _NivatoonAppState();
}

class _NivatoonAppState extends State<NivatoonApp> {
  late final NivatoonRepository _repo;

  @override
  void initState() {
    super.initState();
    _repo = widget.repository ?? NivatoonRepository();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _repo,
      builder: (BuildContext context, _) {
        final isDark = _repo.isDarkMode;
        return MaterialApp(
          title: 'NIVATOON',
          debugShowCheckedModeBanner: false,
          themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF00DC64),
              brightness: Brightness.light,
            ),
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF00DC64),
              brightness: Brightness.dark,
            ),
          ),
          home: widget.home ?? _buildActiveGate(),
        );
      },
    );
  }

  Widget _buildActiveGate() {
    if (_repo.useLiveWebView) {
      return NivatoonShellView(
        onSwitchToNative: () => _repo.setUseLiveWebView(false),
      );
    }
    if (!_repo.isAuthenticated) {
      return AuthScreen(repo: _repo);
    }
    if (!_repo.isPinUnlocked) {
      return PinSecurityGateScreen(repo: _repo);
    }
    return MainHomeShell(repo: _repo);
  }
}
