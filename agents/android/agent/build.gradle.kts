import com.android.build.api.artifact.SingleArtifact

plugins {
    id("com.android.application")
}

android {
    namespace = "dev.pragu.agent"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.pragu.agent"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the local debug key until release signing moves to CI secrets (M2).
            signingConfig = signingConfigs.getByName("debug")
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
