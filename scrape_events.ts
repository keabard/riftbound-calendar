import { chromium } from 'playwright';

async function scrapeEvents() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the events page
    await page.goto('https://locator.riftbound.uvsgames.com/events');

    // Handle cookie banner if it appears
    try {
      const cookieButton = page.getByRole('button', { name: 'Accept All' });
      if (await cookieButton.isVisible()) {
        await cookieButton.click();
      }
    } catch (e) {
      // Ignore if cookie banner doesn't appear or behaves differently
    }

    // Input location
    await page.fill('#address-autocomplete-input', 'Paris, France');
    
    // Wait for autocomplete and select the option
    // The browser subagent saw "Paris, France" in the autocomplete
    const autocompleteOption = page.locator('.pac-item', { hasText: 'Paris, France' }).first();
    // Sometimes Google Places autocomplete takes a moment
    await page.waitForSelector('.pac-item'); 
    await autocompleteOption.click();

    // Open distance filter
    await page.click('text=Distance'); // Based on "Distance-Any" button description, text selector is robust here

    // Select 5 miles (closest to 8 miles)
    // The subagent saw "5 mi" option
    await page.click('text=5 mi');

    // Wait for results to update. 
    // We can wait for the list to refresh. A simple way is to wait for a network idle or a specific element change.
    // Let's wait for the event cards to be visible.
    await page.waitForTimeout(2000); // Give it a moment to filter

    const events = [];
    let hasNextPage = true;

    while (hasNextPage) {
      // Scrape current page
      const cards = await page.$$('a[href^="/events/"]');
      
      for (const card of cards) {
        const titleEl = await card.$('h3');
        const title = titleEl ? await titleEl.innerText() : 'Unknown Title';

        // Date and Time are in spans. 
        // Structure observed: h3 -> div -> div -> span (date), span (time)
        // Let's use more generic selectors relative to the card to be safe
        const textContent = await card.innerText();
        const lines = textContent.split('\n');
        
        // A more precise way using selectors if possible
        // The subagent saw:
        // Title: h3
        // Date: div > div > span:nth-child(1)
        // Time: div > div > span:nth-child(2)
        
        // Let's try to extract structured data
        const dateEl = await card.$('xpath=.//div/div/span[1]');
        const timeEl = await card.$('xpath=.//div/div/span[2]');
        const locationEls = await card.$$('xpath=.//div/div/span'); // There are more spans for location
        
        // The location spans are after the time span.
        // Let's just grab all text and parse or store it.
        // But for "all future events", structured is better.
        
        const date = dateEl ? await dateEl.innerText() : '';
        const time = timeEl ? await timeEl.innerText() : '';
        
        // Location seems to be in subsequent spans.
        // Let's grab the full text of the card to be sure we don't miss anything, 
        // but also try to structure it.
        
        events.push({
          title,
          date,
          time,
          link: await card.getAttribute('href'),
          fullText: textContent
        });
      }

      // Check for pagination
      // Subagent saw "Next" button.
      const nextButton = page.locator('button', { hasText: 'Next' });
      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(2000); // Wait for next page load
      } else {
        hasNextPage = false;
      }
    }

    console.log(JSON.stringify(events, null, 2));

  } catch (error) {
    console.error('Error scraping events:', error);
  } finally {
    await browser.close();
  }
}

scrapeEvents();
