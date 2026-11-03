package dev.pragu.fixtures.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF1A1A18)

// Seeds: a long help screen whose titles look like headings but are not marked as such
// (structure/no-headings), a close button named "Close button" (name/role-in-label), a button
// named just "Icon" (name/generic) and a pale share icon (contrast/non-text). Twins: a dark 48 dp
// back button named "Back", and a 40 dp clickable Box that Compose enlarges to 48 dp. Every
// other screen of this fixture has a heading, so each is a twin for structure/no-headings.
@Composable
fun HelpScreen() {
    Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 48.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = {}, modifier = Modifier.testTag("twin-labeled-back-help")) {
                Icon(BackArrow, contentDescription = "Back")
            }
            // Seeded barrier: big and bold, but not a heading for a screen reader.
            Text(
                "Help",
                color = Ink,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f).testTag("screen-help"),
            )
            // Seeded barrier: TalkBack says "Close button, Button".
            IconButton(onClick = {}, modifier = Modifier.testTag("seed-role-in-label-close")) {
                Icon(Close, contentDescription = "Close button")
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Seeded barrier: a name that says nothing about the action.
            IconButton(onClick = {}, modifier = Modifier.testTag("seed-generic-name")) {
                Icon(MoreVertical, contentDescription = "Icon", tint = Ink)
            }
            // Seeded barrier: #C8C8C8 on white is 1.6:1; icons need 3:1.
            IconButton(onClick = {}, modifier = Modifier.testTag("seed-pale-icon")) {
                Icon(Star, contentDescription = "Share", tint = Color(0xFFC8C8C8))
            }
            // Twin for target/platform-size: drawn at 40 dp, but Compose enlarges a small
            // clickable's touch area to 48 dp and reports that area, so it is not a barrier.
            Box(
                Modifier
                    .padding(start = 8.dp)
                    .size(40.dp)
                    .border(2.dp, Ink, CircleShape)
                    .clickable {}
                    .semantics { contentDescription = "Add note" }
                    .testTag("twin-enlarged-small-target"),
            )
        }
        Section("Orders", "Track an order from the Orders tab.", "Orders can be changed until they ship.")
        Section("Payments", "We accept cards and bank transfers.", "Refunds arrive within five working days.")
        Section("Account", "Change your email in Settings.", "Delete your account from the Account tab.")
    }
}

@Composable
private fun Section(title: String, first: String, second: String) {
    Text(title, color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 24.dp))
    Text(first, color = Ink, fontSize = 16.sp, modifier = Modifier.padding(top = 8.dp))
    Text(second, color = Ink, fontSize = 16.sp, modifier = Modifier.padding(top = 4.dp))
}
