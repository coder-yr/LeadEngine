import asyncio
import logging
import urllib.parse
from typing import List, Dict, Optional
from playwright.async_api import async_playwright, Page

logger = logging.getLogger(__name__)

async def scrape_google_maps(keyword: str, city: str) -> List[Dict[str, Optional[str]]]:
    """
    Asynchronously scrapes Google Maps for businesses matching a keyword in a city.
    
    Args:
        keyword (str): The business type or keyword (e.g., 'dentist')
        city (str): The location (e.g., 'mumbai')
        
    Returns:
        List[Dict]: A list of extracted business profiles containing:
            - Business Name
            - Address
            - Website
            - Phone
            - Rating
    """
    search_query = urllib.parse.quote(f"{keyword} {city}")
    url = f"https://www.google.com/maps/search/{search_query}"
    
    extracted_data = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until='networkidle', timeout=60000)
            
            # Wait for either the search results feed to load
            try:
                await page.wait_for_selector('div[role="feed"]', timeout=15000)
            except Exception:
                logger.warning("Feed not found. Proceeding to check for listings.")
            
            # 'hfpxzc' is the common class for the clickable overlay on map listings
            listings = await page.locator('.hfpxzc').all()
            logger.info(f"Found {len(listings)} listings on the initial load.")
            
            # For production-ready stability in this phase, we process the loaded items.
            # (A deeper implementation would scroll the feed to load pagination)
            for listing in listings:
                business_data = {
                    "Business Name": None,
                    "Address": None,
                    "Website": None,
                    "Phone": None,
                    "Rating": None
                }
                
                try:
                    # Business Name is usually the aria-label of the link
                    name = await listing.get_attribute('aria-label')
                    if name:
                        business_data["Business Name"] = name
                    
                    # Click to load details in the sidebar
                    await listing.click()
                    
                    # Wait for the side panel to update with the new business name
                    try:
                        await page.wait_for_selector(f'h1:has-text("{name}")', timeout=5000)
                        await page.wait_for_timeout(1000) # Small buffer for DOM elements to render
                    except Exception:
                        logger.warning(f"Timeout waiting for details panel of {name}")
                        continue
                    
                    # Extract Rating
                    rating_element = await page.query_selector('span[aria-label*="stars"]')
                    if rating_element:
                        rating_text = await rating_element.get_attribute('aria-label')
                        if rating_text:
                            # Usually formats as "4.5 stars"
                            business_data["Rating"] = rating_text.split()[0]
                    
                    # Extract Address
                    address_btn = await page.query_selector('button[data-item-id="address"]')
                    if address_btn:
                        aria_label = await address_btn.get_attribute('aria-label')
                        if aria_label and "Address: " in aria_label:
                            business_data["Address"] = aria_label.replace("Address: ", "").strip()
                            
                    # Extract Phone
                    phone_btn = await page.query_selector('button[data-item-id^="phone:tel:"]')
                    if phone_btn:
                        aria_label = await phone_btn.get_attribute('aria-label')
                        if aria_label and "Phone: " in aria_label:
                            business_data["Phone"] = aria_label.replace("Phone: ", "").strip()
                            
                    # Extract Website
                    website_btn = await page.query_selector('a[data-item-id="authority"]')
                    if website_btn:
                        href = await website_btn.get_attribute('href')
                        if href:
                            business_data["Website"] = href
                            
                    extracted_data.append(business_data)
                    logger.info(f"Successfully extracted: {business_data['Business Name']}")
                    
                except Exception as item_err:
                    logger.error(f"Error extracting item details: {item_err}")
                    continue
                    
        except Exception as e:
            logger.error(f"Critical error during Google Maps scraping: {e}")
        finally:
            await browser.close()
            
    return extracted_data
