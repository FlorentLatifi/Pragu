package dev.pragu.fixtures.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF1A1A18)

// Seeds for text/scaling-truncation (WCAG 1.4.4): a one-line product name and text in a
// fixed-height box. Both fit at the normal font size and are cut off at 200%. Twins: the
// same name allowed to wrap, a short one-line label that still fits, and a box that grows.
// Everything sits near the top so it stays on screen when text doubles.
@Composable
fun SummaryScreen() {
    Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 48.dp)) {
        Text(
            "Order summary",
            style = MaterialTheme.typography.headlineSmall,
            color = Ink,
            modifier = Modifier.padding(bottom = 16.dp).testTag("screen-summary").semantics { heading() },
        )
        Text(
            "Ceramic mug, sage green, 350 ml",
            color = Ink,
            fontSize = 16.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(bottom = 12.dp).testTag("seed-truncated-name"),
        )
        Text(
            "Ceramic mug, sage green, 350 ml",
            color = Ink,
            fontSize = 16.sp,
            modifier = Modifier.padding(bottom = 12.dp).testTag("twin-wrapping-name"),
        )
        Text(
            "Total",
            color = Ink,
            fontSize = 16.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(bottom = 12.dp).testTag("twin-short-line"),
        )
        Box(Modifier.height(24.dp).clipToBounds(), contentAlignment = Alignment.CenterStart) {
            Text("Ships in 2–4 days", color = Ink, fontSize = 14.sp, modifier = Modifier.testTag("seed-clipped-box-text"))
        }
        Box(Modifier.padding(top = 12.dp).heightIn(min = 24.dp), contentAlignment = Alignment.CenterStart) {
            Text("Ships in 2–4 days", color = Ink, fontSize = 14.sp, modifier = Modifier.testTag("twin-growing-box-text"))
        }
    }
}
