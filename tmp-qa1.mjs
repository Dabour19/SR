export default async function run(page, ui) {
  await page.waitForTimeout(3000);
  // open the account/profile modal
  await ui.click('@e9');
  await page.waitForTimeout(1500);
  const snap = await ui.snapshot();
  return { snap: snap.slice(0, 5000) };
}
