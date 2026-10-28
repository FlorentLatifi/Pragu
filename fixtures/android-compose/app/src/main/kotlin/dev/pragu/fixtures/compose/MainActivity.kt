package dev.pragu.fixtures.compose

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId

// Pragu fixture "android-compose": Jetpack Compose screens that seed accessibility
// barriers next to correct twins. Pragu Bench opens them by deep link
// (composeshop://settings, composeshop://checkout) and checks the scan against
// expected.json, keyed by testTag.
class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val screen = intent?.data?.host ?: "settings"
        setContent {
            MaterialTheme(colorScheme = lightColorScheme()) {
                // Exposes every testTag as the view's resource id, which the bench's labels use.
                Surface(Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }, color = Color.White) {
                    when (screen) {
                        "checkout" -> CheckoutScreen()
                        else -> SettingsScreen()
                    }
                }
            }
        }
    }
}
