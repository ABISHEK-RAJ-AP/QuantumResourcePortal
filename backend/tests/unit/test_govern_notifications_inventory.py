"""QRP frontend notification stack — file and shell wiring."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FE = ROOT / "frontend" / "src"


def test_qrp_notification_modules_present():
    required = [
        FE / "lib/governNotices.ts",
        FE / "lib/governServerFeed.ts",
        FE / "lib/notificationPanel.ts",
        FE / "lib/toast.ts",
        FE / "components/notifications/NotificationHost.tsx",
        FE / "components/notifications/NotificationBell.tsx",
        FE / "components/notifications/GovernNotificationSync.tsx",
        FE / "components/ui/notify-item.tsx",
        FE / "styles/qre-notify.css",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    assert not missing, f"missing: {missing}"


def test_chrome_wires_notification_stack():
    chrome = (FE / "components/layout/chrome.tsx").read_text(encoding="utf-8")
    assert "NotificationHost" in chrome
    assert "NotificationBell" in chrome
    assert "GovernNotificationSync" in chrome


def test_server_feed_uses_qrp_rbac_permissions():
    feed = (FE / "lib/governServerFeed.ts").read_text(encoding="utf-8")
    assert "approval:read" in feed
    assert "approval:decide" in feed
    assert "approvals:read" not in feed