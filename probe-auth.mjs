export default async function run(page, ui) {
  // Open the friends/team panel (🍻 building) and try to create a team.
  await ui.click('@e7');
  await page.waitForTimeout(1200);
  const snap = await ui.snapshot();
  const createBtn = snap.match(/@(e\d+) button "([^"]*إنشاء فريق[^"]*)"/)?.[1];
  if (!createBtn) return { error: 'create-team button not found', snap };
  await ui.click(createBtn);
  await page.waitForTimeout(4000);
  const toast = await page.evaluate(() => document.body.innerText.match(/تم إنشاء الفريق[^\n]*|فشل[^\n]*|تعذر[^\n]*/)?.[0] || null);
  const snap2 = await ui.snapshot();
  return { toast, teamCode: snap2.match(/رمز الفريق[\s\S]{0,80}/)?.[0] || null };
}
