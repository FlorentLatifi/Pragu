import com.android.build.api.artifact.SingleArtifact

plugins {
    id("com.android.application")
}

android {
    namespace = "dev.pragu.agent"
    compileSdk = 37

    defaultConfig {
        applicationId = "dev.pragu.agent"
        minSdk = 26
        targetSdk = 37
        // The release workflow sets both from the tag, so the agent's version is the CLI's (ADR-013).
        versionCode = System.getenv("PRAGU_VERSION_CODE")?.toInt() ?: 5
        versionName = System.getenv("PRAGU_VERSION") ?: "0.0.5"
    }

    // The release keystore lives only in CI secrets (ADR-013); local and pull-request builds use the debug key.
    val keystore = System.getenv("PRAGU_KEYSTORE_FILE")
    signingConfigs {
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = System.getenv("PRAGU_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("PRAGU_KEY_ALIAS")
                keyPassword = System.getenv("PRAGU_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (keystore != null) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    lint {
        abortOnError = true
        // Version bumps of AGP and Gradle come through Dependabot, delayed 7 days (D-36, F-10); a "newer version" hint is expected noise.
        disable += "AndroidGradlePluginVersion"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    // Android's own org.json is a stub in JVM unit tests; this is the real implementation.
    testImplementation("org.json:json:20260814")
}

/** Fails the build if the merged manifest asks for network access. The agent must reach the CLI only through adb. */
abstract class VerifyNoInternetPermission : DefaultTask() {
    @get:InputFile
    abstract val mergedManifest: RegularFileProperty

    @TaskAction
    fun verify() {
        val manifest = mergedManifest.get().asFile.readText()
        if (manifest.contains("android.permission.INTERNET")) {
            throw GradleException("The agent must not request android.permission.INTERNET (see docs/adr/006-agent-transport.md).")
        }
        logger.lifecycle("OK: merged manifest has no INTERNET permission.")
    }
}

androidComponents {
    onVariants { variant ->
        val name = variant.name.replaceFirstChar { it.uppercase() }
        tasks.register<VerifyNoInternetPermission>("verify${name}NoInternetPermission") {
            mergedManifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
        }
    }
}
