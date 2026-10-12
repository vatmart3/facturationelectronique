import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function sansDefilementHorizontal(page: Page) {
  const largeurs = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(largeurs[0]).toBeLessThanOrEqual(largeurs[1]!)
}

async function sansViolationAxe(page: Page) {
  const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(resultat.violations.map((v) => `${v.id}: ${v.nodes.length} élément(s)`)).toEqual([])
}

test.describe('pages publiques', () => {
  test('le design system s’affiche et respecte WCAG AA', async ({ page }) => {
    await page.goto('/systeme')
    await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible()
    await expect(page.getByText('F-2026-0042')).toBeVisible()
    await expect(page.getByText('4 218,00 €').first()).toBeVisible()
    await sansDefilementHorizontal(page)
    await sansViolationAxe(page)
  })

  test('le design system reste lisible en mode sombre', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/systeme')
    await sansViolationAxe(page)
  })

  test('la connexion signale une configuration manquante et propose deux méthodes', async ({ page }) => {
    await page.goto('/connexion')
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
    await expect(page.getByText('Supabase n’est pas encore configuré')).toBeVisible()
    await page.getByRole('tab', { name: 'Lien par email' }).click()
    await expect(page.getByRole('button', { name: 'Recevoir le lien' })).toBeVisible()
    await sansDefilementHorizontal(page)
    await sansViolationAxe(page)
  })

  test('l’inscription s’affiche', async ({ page }) => {
    await page.goto('/inscription')
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
    await sansViolationAxe(page)
  })

  test('une page privée renvoie vers la connexion', async ({ page }) => {
    await page.goto('/atelier-lumen/tableau-de-bord')
    await expect(page).toHaveURL(/\/connexion/)
  })

  test('les redirections externes sont ignorées', async ({ page }) => {
    await page.goto('/connexion?suite=https://pirate.example')
    const suite = await page.locator('input[name="suite"]').first().inputValue()
    expect(suite).toBe('/')
  })
})

test.describe('coque applicative', () => {
  test('affiche les catégories et la palette de commande', async ({ page, isMobile }) => {
    await page.goto('/systeme/coque')
    await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible()

    if (isMobile) {
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    }
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    for (const groupe of ['Pilotage', 'Ventes', 'Relation client', 'Facturation électronique', 'Comptabilité']) {
      await expect(nav.getByText(groupe, { exact: true })).toBeVisible()
    }
    await expect(nav.getByRole('link', { name: 'Factures', exact: true })).toHaveAttribute('href', '/demo/ventes/factures')

    await page.keyboard.press('Escape')
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined)
    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: 'Rechercher et naviguer' })
    await expect(palette).toBeVisible()
    await page.getByRole('combobox').fill('reforme')
    await expect(palette.getByRole('option')).toHaveText([/Réforme 2027/])
    await page.getByRole('combobox').fill('nebuleuse')
    await expect(palette.getByRole('option')).toHaveText([/Studio Nébuleuse/])
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    await sansDefilementHorizontal(page)
    await sansViolationAxe(page)
  })
})
