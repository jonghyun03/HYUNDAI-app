plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "kr.wooricha.fm"
    compileSdk = 35
    buildToolsVersion = "35.0.0"
    useLibrary("android.car")
    defaultConfig {
        applicationId = "kr.wooricha.fm"
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-vehicle"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // Public test tones work directly in Android Studio; private media stays outside source.
    val mediaDirectory = providers.environmentVariable("WOORICHA_MEDIA_DIR")
        .orElse(rootProject.layout.projectDirectory.dir("../demo/vehicle").asFile.absolutePath)
    sourceSets.getByName("main") {
        assets.srcDir("${mediaDirectory.get()}/assets")
        res.srcDir("${mediaDirectory.get()}/res")
    }
    buildTypes { release { isMinifyEnabled = false } }
}

dependencies {
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-session:1.8.0")
    implementation("androidx.core:core-ktx:1.15.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
