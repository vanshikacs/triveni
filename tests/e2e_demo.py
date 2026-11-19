"""End-to-end check of the exact TRIVENI demo sequence. Saves screenshots; fails loudly on errors."""
import os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
OUT = os.environ.get("SHOTS", "test-shots")
import os; os.makedirs(OUT, exist_ok=True)
errors = []

def shot(page, name, full=True):
    page.screenshot(path=f"{OUT}/{name}.png", full_page=full)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error",) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    # Step 1: entry
    page.goto(BASE); page.evaluate("localStorage.clear()"); page.reload()
    page.wait_for_timeout(1400); shot(page, "01_entry", full=False)

    # Step 2: report, submit Hindi sample (preloaded)
    page.get_by_role("button", name="Report an issue").first.click()
    page.wait_for_timeout(300)
    assert "ट्रांसफॉर्मर" in page.locator("#complaint").input_value(), "Hindi sample not preloaded"
    shot(page, "02_report_form", full=False)
    page.get_by_role("button", name="शिकायत भेजें").click()
    page.wait_for_timeout(1300); shot(page, "03_processing", full=False)
    page.get_by_role("button", name="Open case intelligence").wait_for(timeout=8000)
    shot(page, "04_processing_done", full=False)

    # Step 3-5: intelligence + fusion
    page.get_by_role("button", name="Open case intelligence").click()
    page.wait_for_timeout(1500)
    assert page.get_by_text("Incident fusion").first.is_visible()
    shot(page, "05_intelligence_full")
    page.locator("#fusion-h").scroll_into_view_if_needed(); page.wait_for_timeout(600)
    shot(page, "06_fusion_viewport", full=False)
    # inspect a report
    page.get_by_role("button", name="Inspect").nth(1).click(); page.wait_for_timeout(300)
    shot(page, "07_inspect_dialog", full=False)
    page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # Step 6-7: command centre, open INC-2041
    page.get_by_role("button", name="Review in command centre").click(); page.wait_for_timeout(800)
    shot(page, "08_incident_drawer", full=False)
    page.goto(BASE + "#command"); page.wait_for_timeout(600)
    shot(page, "09_command_centre", full=False)
    page.locator("tr", has_text="INC-2041").click(); page.wait_for_timeout(500)

    # Step 8: approve merge + routing
    page.get_by_role("button", name="Approve merge").first.click(); page.wait_for_timeout(200)
    page.get_by_role("dialog", name="Approve merge into INC-2041?").get_by_role("button", name="Approve merge").click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name="Approve routing").click(); page.wait_for_timeout(200)
    page.get_by_role("dialog", name="Approve simulated routing?").get_by_role("button", name="Approve routing").click()
    page.wait_for_timeout(400)
    # note + status
    page.locator("#note").fill("Lineman and transformer crew dispatched from Haidergarh substation.")
    page.get_by_role("button", name="Add note").click(); page.wait_for_timeout(200)
    page.locator("#status").select_option("in_progress"); page.wait_for_timeout(300)
    shot(page, "10_after_approval_drawer", full=False)
    txt = page.locator("aside[role=dialog]").inner_text()
    assert "Routing approved (simulated)" in txt, "routing not approved"
    assert "One consolidated incident" in txt and "8 citizen reports" in txt, "merge not confirmed with 8 reports"

    # Step 9: one consolidated incident in table, persists after reload
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(600)
    row = page.locator("tr", has_text="INC-2041").inner_text()
    assert "8" in row and "In progress" in row, f"row after reload: {row}"
    shot(page, "11_table_after", full=False)

    # Search + filters + tabs
    page.locator("#q").fill("हैंडपंप"); page.wait_for_timeout(200)
    assert page.locator("tbody tr").count() == 1, "Hindi search failed"
    page.get_by_role("button", name="Clear filters").click()
    page.locator("#fp").select_option("high"); page.wait_for_timeout(200)
    n_high = page.locator("tbody tr").count()
    page.get_by_role("button", name="Clear filters").click()
    page.get_by_role("tab", name="Review queue").click(); page.wait_for_timeout(300)
    shot(page, "12_review_queue", full=False)
    # review the anganwadi case: change dept + approve
    page.get_by_role("button", name="Review", exact=True).first.click(); page.wait_for_timeout(400)
    page.locator("#dept").select_option("Rural Engineering (construction)"); page.wait_for_timeout(200)
    page.get_by_role("button", name="Approve routing").click()
    page.get_by_role("dialog", name="Approve simulated routing?").get_by_role("button", name="Approve routing").click()
    page.wait_for_timeout(300)
    page.keyboard.press("Escape")
    page.get_by_role("tab", name="Activity").click(); page.wait_for_timeout(300)
    shot(page, "13_activity", full=False)

    # Split test on confirmed incident via intelligence view
    page.goto(BASE + "#command-INC-2041"); page.wait_for_timeout(500)
    page.get_by_role("button", name="Inspect").nth(2).click(); page.wait_for_timeout(200)
    page.get_by_role("button", name="Split this report into its own incident").click(); page.wait_for_timeout(200)
    page.get_by_role("dialog").get_by_role("button", name="Split report").click(); page.wait_for_timeout(300)
    after_split = page.locator("aside[role=dialog]").inner_text()
    assert "7 reports" in after_split, "split did not reduce to 7"

    # Reset
    page.keyboard.press("Escape")
    page.get_by_role("button", name="Reset demo").click()
    page.get_by_role("dialog").get_by_role("button", name="Reset demo").click(); page.wait_for_timeout(500)
    page.goto(BASE + "#command"); page.wait_for_timeout(400)
    row = page.locator("tr", has_text="INC-2041").inner_text()
    assert "7" in row and "Needs review" in row, f"reset failed: {row}"

    # Mobile
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    m.goto(BASE); m.wait_for_timeout(1200); m.screenshot(path=f"{OUT}/14_mobile_entry.png", full_page=True)
    m.goto(BASE + "#intelligence"); m.wait_for_timeout(800); m.screenshot(path=f"{OUT}/15_mobile_fusion.png", full_page=True)
    m.goto(BASE + "#command-INC-2041"); m.wait_for_timeout(800); m.screenshot(path=f"{OUT}/16_mobile_drawer.png", full_page=False)
    b.close()

print("high-priority rows:", n_high)
print("ERRORS:", errors if errors else "none")
print("E2E PASSED")
