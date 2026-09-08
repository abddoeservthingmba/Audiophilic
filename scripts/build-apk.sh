#!/usr/bin/env bash
# =============================================================
# Audiophilic — Full APK Build Script
# =============================================================
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Audiophilic APK Build Pipeline    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Step 1: Next.js static export
echo "▶ [1/3] Building Next.js static export..."
npm run build
echo "✓ Next.js build complete"

# Step 2: Sync web assets to Capacitor Android project
echo ""
echo "▶ [2/3] Syncing Capacitor assets..."
npx cap sync android
echo "✓ Capacitor sync complete"

# Step 3: Build debug APK with Gradle
echo ""
echo "▶ [3/3] Building Android debug APK..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon
cd ..

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ APK Built Successfully!                                  ║"
echo "║  📦 Output: android/app/build/outputs/apk/debug/app-debug.apk ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Print file size
if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
  APK_SIZE=$(du -sh "android/app/build/outputs/apk/debug/app-debug.apk" | cut -f1)
  echo "APK size: $APK_SIZE"
fi
