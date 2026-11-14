plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseStore = providers.environmentVariable("WOORICHA_KEYSTORE").orNull
val releaseStorePassword = providers.environmentVariable("WOORICHA_KEYSTORE_PASSWORD").orNull
val releaseAlias = providers.environmentVariable("WOORICHA_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("WOORICHA_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(releaseStore, releaseStorePassword, releaseAlias, releaseKeyPassword)
    .all { !it.isNullOrBlank() }

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
    testBuildType = providers.gradleProperty("woorichaTestBuildType").getOrElse("debug")
    // Public test tones work directly in Android Studio; private media stays outside source.
    val mediaDirectory = providers.environmentVariable("WOORICHA_MEDIA_DIR")
        .orElse(rootProject.layout.projectDirectory.dir("../demo/vehicle").asFile.absolutePath)
    sourceSets.getByName("main") {
        assets.srcDir("${mediaDirectory.get()}/assets")
        res.srcDir("${mediaDirectory.get()}/res")
    }
    signingConfigs {
        if (hasReleaseSigning) {
            create("contestRelease") {
                storeFile = file(releaseStore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }
    buildTypes {
        release {
            isDebuggable = false
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("contestRelease")
        }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        check(hasReleaseSigning) {
            "Release signing is required. Use scripts/build-vehicle.py --release with a private signing config or WOORICHA_KEYSTORE* environment variables."
        }
    }
}

dependencies {
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-session:1.8.0")
    implementation("androidx.core:core-ktx:1.15.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
