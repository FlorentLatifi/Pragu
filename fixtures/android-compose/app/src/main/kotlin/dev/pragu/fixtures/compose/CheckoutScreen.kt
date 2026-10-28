package dev.pragu.fixtures.compose

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

private val Ink = Color(0xFF1A1A18)
private val Green = Color(0xFF1F5E4B)

// Seeds: a field labelled only by its placeholder, a field whose visible label is not
// connected to it, a home-made checkbox with no name, role or state, and a checkbox role
// with no state. Twins: a field
// with a real label, a toggleable checkbox row, a text button, and a disabled button
// (WCAG sets no contrast requirement for it).
@Composable
fun CheckoutScreen() {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var promo by remember { mutableStateOf("") }
    var terms by remember { mutableStateOf(false) }
    var saveCard by remember { mutableStateOf(false) }
    var giftWrap by remember { mutableStateOf(true) }
    Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 48.dp)) {
        Text(
            "Checkout",
            style = MaterialTheme.typography.headlineSmall,
            color = Ink,
            modifier = Modifier.padding(bottom = 16.dp).testTag("screen-checkout").semantics { heading() },
        )
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Full name") },
            modifier = Modifier.fillMaxWidth().testTag("twin-labelled-field"),
        )
        // Seeded barrier: the placeholder disappears as soon as someone types; there is no label.
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            placeholder = { Text("Email address") },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp).testTag("seed-placeholder-field"),
        )
        // Seeded barrier: the text above is not connected to the field, which has no label of
        // its own, so TalkBack says only "Edit box".
        Text("Promo code", color = Ink, modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        OutlinedTextField(
            value = promo,
            onValueChange = { promo = it },
            modifier = Modifier.fillMaxWidth().testTag("seed-unlabeled-field"),
        )

        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .toggleable(value = terms, role = Role.Checkbox, onValueChange = { terms = it })
                .testTag("twin-checkbox-row"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = terms, onCheckedChange = null)
            Text("I accept the terms", color = Ink, modifier = Modifier.padding(start = 8.dp))
        }

        // Seeded barrier: a clickable box drawn as a checkbox, with no name, role or state.
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(48.dp).clickable { saveCard = !saveCard }.testTag("seed-custom-checkbox"),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(20.dp)
                        .border(2.dp, Ink, RoundedCornerShape(4.dp))
                        .background(if (saveCard) Green else Color.Transparent, RoundedCornerShape(4.dp)),
                )
            }
            Text("Save this card", color = Ink)
        }

        // Seeded barrier: clickable(role = Role.Checkbox) gives a checkbox role but no state, so
        // TalkBack never says "checked". toggleable exposes both.
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clickable(role = Role.Checkbox) { giftWrap = !giftWrap }
                .testTag("seed-stateless-checkbox"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .padding(start = 14.dp)
                    .size(20.dp)
                    .border(2.dp, Ink, RoundedCornerShape(4.dp))
                    .background(if (giftWrap) Green else Color.Transparent, RoundedCornerShape(4.dp)),
            )
            Text("Gift wrap this order", color = Ink, modifier = Modifier.padding(start = 22.dp))
        }

        // Seeded barrier: hideFromAccessibility() keeps the button working by touch only.
        TextButton(onClick = {}, modifier = Modifier.semantics { hideFromAccessibility() }.testTag("seed-hidden-button")) {
            Text("Save cart for later")
        }

        Button(onClick = {}, modifier = Modifier.fillMaxWidth().padding(top = 16.dp).testTag("twin-pay-button")) {
            Text("Pay €36.00")
        }
        Button(
            onClick = {},
            enabled = false,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp).testTag("twin-disabled-button"),
        ) {
            Text("Use saved card", modifier = Modifier.testTag("twin-disabled-text"))
        }
    }
}
