package dev.pragu.fixtures.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF1A1A18)
private val Grey = Color(0xFF5E5C57)

// Seeds: an icon button whose Icon has contentDescription = null, a Switch whose
// label is not connected to it, pale text, and a row of touching 16 dp stars.
// Twins: a labelled IconButton, a toggleable row that names its Switch, readable
// text, large text that passes at 3:1, and small icons Compose enlarges enough.
@Composable
fun SettingsScreen() {
    var notifications by remember { mutableStateOf(true) }
    var darkTheme by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 48.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = {}, modifier = Modifier.testTag("twin-labeled-back")) {
                Icon(BackArrow, contentDescription = "Back")
            }
            Text(
                "Settings",
                style = MaterialTheme.typography.headlineSmall,
                color = Ink,
                modifier = Modifier.weight(1f).testTag("screen-settings").semantics { heading() },
            )
            // Seeded barrier: the classic Compose mistake, Icon(contentDescription = null) in an IconButton.
            IconButton(onClick = {}, modifier = Modifier.testTag("seed-unlabeled-more")) {
                Icon(MoreVertical, contentDescription = null)
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .toggleable(value = notifications, role = Role.Switch, onValueChange = { notifications = it })
                .testTag("twin-labeled-switch-row"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Notifications", color = Ink, modifier = Modifier.weight(1f))
            Switch(checked = notifications, onCheckedChange = null)
        }

        // Seeded barrier: the Switch has its own semantics, so the text beside it never names it.
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Dark theme", color = Ink, modifier = Modifier.weight(1f))
            Switch(
                checked = darkTheme,
                onCheckedChange = { darkTheme = it },
                modifier = Modifier.testTag("seed-unlabeled-switch"),
            )
        }

        // Seeded barrier: #B0B0B0 on white is 2.1:1.
        Text(
            "Last synced 2 hours ago",
            color = Color(0xFFB0B0B0),
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 16.dp).testTag("seed-low-contrast-synced"),
        )
        Text(
            "App version 1.0",
            color = Grey,
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 8.dp).testTag("twin-good-contrast-version"),
        )
        // 28 sp is large text, so 3.2:1 passes WCAG 1.4.3 (it needs 3:1).
        Text(
            "Storage",
            color = Color(0xFF8E8E8E),
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 24.dp).testTag("twin-large-text"),
        )

        // Twins: two 20 dp icons 2 dp apart. Compose enlarges a small clickable's touch area
        // to 48 dp and gives each touch to the nearer icon, so each one accepts touches over
        // more than 24 dp. Checked on the emulator with held presses beside each icon.
        Row(Modifier.padding(top = 16.dp).heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Cache", color = Ink, modifier = Modifier.weight(1f))
            Box(
                Modifier
                    .size(20.dp)
                    .border(1.5.dp, Ink, CircleShape)
                    .clickable {}
                    .semantics { contentDescription = "Clear cache" }
                    .testTag("twin-expanded-clear"),
            )
            Box(
                Modifier
                    .padding(start = 2.dp)
                    .size(20.dp)
                    .border(1.5.dp, Ink, CircleShape)
                    .clickable {}
                    .semantics { contentDescription = "Cache details" }
                    .testTag("twin-expanded-info"),
            )
        }

        // Seeded barrier: 16 dp stars that touch. A touch inside a star always goes to that
        // star, so the enlargement cannot help the middle three: each takes touches over 16 dp
        // only. The two end stars gain the free side's enlargement and pass.
        var rating by remember { mutableIntStateOf(0) }
        Row(Modifier.padding(top = 16.dp).heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Rate this app", color = Ink, modifier = Modifier.weight(1f))
            for (star in 1..5) {
                val tag = if (star == 1 || star == 5) "twin-star-$star" else "seed-crowded-star-$star"
                Box(
                    Modifier
                        .size(16.dp)
                        .clickable(role = Role.Button) { rating = star }
                        .semantics { contentDescription = "Rate $star of 5" }
                        .testTag(tag),
                ) {
                    Icon(Star, contentDescription = null, tint = if (star <= rating) Ink else Grey)
                }
            }
        }

        // Seeded barrier: two remove buttons both called just "Remove", so a screen reader
        // user cannot tell which device each one removes. Twins: names that say which.
        DeviceRow("Phone", "Remove", "seed-duplicate-remove-phone")
        DeviceRow("Watch", "Remove", "seed-duplicate-remove-watch")
        DeviceRow("Tablet", "Remove Tablet", "twin-unique-remove-tablet")
        DeviceRow("Speaker", "Remove Speaker", "twin-unique-remove-speaker")
    }
}

@Composable
private fun DeviceRow(device: String, removeLabel: String, tag: String) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(device, color = Ink, modifier = Modifier.weight(1f))
        IconButton(onClick = {}, modifier = Modifier.testTag(tag)) {
            Icon(Close, contentDescription = removeLabel)
        }
    }
}
