package dev.pragu.fixtures.compose

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

// Material icons drawn by hand, so the fixture needs no icon library.

val BackArrow: ImageVector = ImageVector.Builder("BackArrow", 24.dp, 24.dp, 24f, 24f).apply {
    path(fill = SolidColor(Color(0xFF1A1A18))) {
        moveTo(20f, 11f)
        horizontalLineTo(7.83f)
        lineToRelative(5.59f, -5.59f)
        lineTo(12f, 4f)
        lineToRelative(-8f, 8f)
        lineToRelative(8f, 8f)
        lineToRelative(1.41f, -1.41f)
        lineTo(7.83f, 13f)
        horizontalLineTo(20f)
        verticalLineToRelative(-2f)
        close()
    }
}.build()

val MoreVertical: ImageVector = ImageVector.Builder("MoreVertical", 24.dp, 24.dp, 24f, 24f).apply {
    path(fill = SolidColor(Color(0xFF1A1A18))) {
        for (centerY in listOf(6f, 12f, 18f)) {
            moveTo(12f, centerY - 2f)
            arcToRelative(2f, 2f, 0f, isMoreThanHalf = true, isPositiveArc = true, dx1 = 0f, dy1 = 4f)
            arcToRelative(2f, 2f, 0f, isMoreThanHalf = true, isPositiveArc = true, dx1 = 0f, dy1 = -4f)
            close()
        }
    }
}.build()

val Star: ImageVector = ImageVector.Builder("Star", 24.dp, 24.dp, 24f, 24f).apply {
    path(fill = SolidColor(Color(0xFF1A1A18))) {
        moveTo(12f, 17.27f)
        lineTo(18.18f, 21f)
        lineToRelative(-1.64f, -7.03f)
        lineTo(22f, 9.24f)
        lineToRelative(-7.19f, -0.61f)
        lineTo(12f, 2f)
        lineTo(9.19f, 8.63f)
        lineTo(2f, 9.24f)
        lineToRelative(5.46f, 4.73f)
        lineTo(5.82f, 21f)
        close()
    }
}.build()
