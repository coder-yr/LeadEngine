"""
overpass.py — Tier 1 OpenStreetMap Overpass API source.

Queries the public Overpass API for businesses matching a keyword + city.
Uses Nominatim to geocode the city into a bounding box first.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional, Tuple

import requests

from discovery.base_source import BaseDiscoverySource, DiscoveryRecord

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_URL_FALLBACK = "https://lz4.overpass-api.de/api/interpreter"

# OSM tags to query for common business types
OSM_TAGS = {
    "dentist": {"amenity": ["dentist"], "healthcare": ["dentist"]},
    "doctor": {"amenity": ["doctors", "clinic"], "healthcare": ["doctor", "clinic"]},
    "hospital": {"amenity": ["hospital"], "healthcare": ["hospital"]},
    "pharmacy": {"amenity": ["pharmacy"], "healthcare": ["pharmacy"]},
    "restaurant": {"amenity": ["restaurant", "cafe", "fast_food", "food_court"]},
    "cafe": {"amenity": ["cafe", "coffee_shop"]},
    "hotel": {"amenity": ["hotel", "guest_house"], "tourism": ["hotel", "guest_house", "motel"]},
    "school": {"amenity": ["school", "college", "university", "kindergarten"]},
    "gym": {"amenity": ["gym", "sports_centre"], "leisure": ["fitness_centre", "sports_centre"]},
    "bank": {"amenity": ["bank", "atm"]},
    "lawyer": {"amenity": ["law_office"], "office": ["lawyer"]},
    "architect": {"office": ["architect", "architects"]},
    "psychologist": {"healthcare": ["psychotherapist", "counselling"]},
    "salon": {"shop": ["hairdresser", "beauty", "massage"]},
    "mechanic": {"shop": ["car_repair", "motorcycle_repair"], "craft": ["car_mechanic"]},
    "plumber": {"craft": ["plumber"]},
    "electrician": {"craft": ["electrician"]},
    "bakery": {"shop": ["bakery", "pastry"]},
    "supermarket": {"shop": ["supermarket", "convenience"]},
    "default": {"office": ["company"], "shop": ["yes"], "amenity": ["yes"]},
}


def _get_osm_tags(keyword: str) -> Dict[str, List[str]]:
    kw = keyword.lower().strip()
    for key, tags in OSM_TAGS.items():
        if key in kw:
            return tags
    return OSM_TAGS["default"]


def _geocode_city(city: str) -> Optional[Tuple[float, float, float, float]]:
    """Returns (south, west, north, east) bounding box or None."""
    try:
        params = {
            "q": city,
            "format": "json",
            "limit": 1,
            "addressdetails": 1,
        }
        headers = {
            "User-Agent": "LeadEngine/2.0 (contact@leadengine.app)",
            "Accept": "application/json",
        }
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data:
            bb = data[0].get("boundingbox")
            if bb and len(bb) == 4:
                return (float(bb[0]), float(bb[2]), float(bb[1]), float(bb[3]))
    except Exception as exc:
        logger.warning(f"[overpass] Geocode failed for '{city}': {exc}")
    return None


def _build_query(bbox: Tuple[float, float, float, float], tags: Dict[str, List[str]], keyword: str) -> str:
    """Build an Overpass QL query."""
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"

    # Build tag filters
    filters = []
    for key, values in tags.items():
        for val in values:
            if val == "yes":
                filters.append(f'  node["{key}"]({box});')
                filters.append(f'  way["{key}"]({box});')
            else:
                filters.append(f'  node["{key}"="{val}"]({box});')
                filters.append(f'  way["{key}"="{val}"]({box});')
                
    # Also search by name if we have a specific keyword
    if len(keyword) > 3:
        # Escape quotes
        kw_safe = keyword.replace('"', '\\"').lower()
        filters.append(f'  node["name"~"{kw_safe}",i]({box});')
        filters.append(f'  way["name"~"{kw_safe}",i]({box});')

    tag_filters = "\n".join(set(filters))

    return f"""
[out:json][timeout:25];
(
{tag_filters}
);
out body center 100;
""".strip()


def _parse_element(el: Dict) -> Optional[DiscoveryRecord]:
    tags = el.get("tags", {})
    name = tags.get("name") or tags.get("name:en")
    if not name:
        return None

    phone = tags.get("phone") or tags.get("contact:phone")
    website = tags.get("website") or tags.get("contact:website")
    email = tags.get("email") or tags.get("contact:email")

    # Build address from OSM address tags
    addr_parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:suburb", ""),
        tags.get("addr:city", ""),
        tags.get("addr:state", ""),
        tags.get("addr:postcode", ""),
    ]
    address = ", ".join(p for p in addr_parts if p).strip(", ")

    rec = DiscoveryRecord(
        business_name=name,
        source="overpass",
        phone=phone,
        website=website,
        email=email,
        address=address or None,
        raw_data={
            "osm_id": el.get("id"),
            "osm_type": el.get("type"),
            "opening_hours": tags.get("opening_hours"),
        },
    )
    rec.quality_score = (
        20  # Base source bonus
        + (40 if website else 0)
        + (25 if phone else 0)
        + (10 if email else 0)
        + (5 if address else 0)
    )
    return rec


class OverpassSource(BaseDiscoverySource):
    name = "overpass"
    tier = 1
    reliability_stars = 5

    async def search(self, keyword: str, city: str, max_results: int, **kwargs) -> List[DiscoveryRecord]:
        # Rate limit: be polite to public Overpass instances (ASYNC sleep, not blocking!)
        await asyncio.sleep(1)

        bbox = _geocode_city(city)
        if not bbox:
            logger.warning(f"[overpass] Could not geocode '{city}'")
            return []

        tags = _get_osm_tags(keyword)
        query = _build_query(bbox, tags, keyword)

        extracted: List[DiscoveryRecord] = []
        seen_names: set = set()

        for endpoint in [OVERPASS_URL, OVERPASS_URL_FALLBACK]:
            try:
                headers = {"User-Agent": "LeadEngine/2.0 (contact@leadengine.app)"}
                resp = requests.post(
                    endpoint,
                    data={"data": query},
                    headers=headers,
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()

                for el in data.get("elements", []):
                    if len(extracted) >= max_results:
                        break
                        
                    rec = _parse_element(el)
                    if rec:
                        name_key = rec.business_name.lower()
                        if name_key not in seen_names:
                            seen_names.add(name_key)
                            extracted.append(rec)

                logger.info(f"[overpass] {len(extracted)} results from {endpoint}")
                break

            except Exception as exc:
                logger.warning(f"[overpass] {endpoint} failed: {exc}")

        return extracted
