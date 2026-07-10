"""
plugin_loader.py — Auto-discovers BaseDiscoverySource subclasses from the sources/ directory.

How it works:
  1. Scans every .py file in the sources/ directory
  2. Imports each module dynamically
  3. Finds all classes that subclass BaseDiscoverySource (excluding the base itself)
  4. Instantiates each class (no arguments)
  5. Returns sorted by tier ascending (Tier 1 first)

Adding a new source:
  1. Create workers/src/discovery/sources/my_new_source.py
  2. Define a class that subclasses BaseDiscoverySource
  3. Set name, tier, reliability_stars at class level
  4. Implement async search()
  5. Done — no registration, no config changes needed.
"""

from __future__ import annotations

import importlib.util
import inspect
import logging
import sys
from pathlib import Path
from typing import List, Optional

from discovery.base_source import BaseDiscoverySource

logger = logging.getLogger(__name__)


class PluginLoader:
    """
    Scans a directory for Python modules and returns all BaseDiscoverySource
    implementations found within them.
    """

    def __init__(self, sources_dir: Optional[Path] = None):
        if sources_dir is None:
            sources_dir = Path(__file__).parent / "sources"
        self.sources_dir = sources_dir

    def load_all(self) -> List[BaseDiscoverySource]:
        """
        Discover and instantiate all source plugins.
        Returns sources sorted by tier (lowest tier number = highest priority).
        Failures to load any single file are logged and skipped.
        """
        sources: List[BaseDiscoverySource] = []
        loaded_names: set = set()

        if not self.sources_dir.exists():
            logger.warning(f"[PluginLoader] Sources directory not found: {self.sources_dir}")
            return sources

        py_files = sorted(self.sources_dir.glob("*.py"))

        for py_file in py_files:
            if py_file.name.startswith("_"):
                continue  # Skip __init__.py, __pycache__ etc.

            try:
                module = self._import_module(py_file)
                if module is None:
                    continue

                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if (
                        issubclass(obj, BaseDiscoverySource)
                        and obj is not BaseDiscoverySource
                        and obj.__module__ == module.__name__  # only from this file
                    ):
                        instance = obj()
                        if instance.name in loaded_names:
                            logger.warning(
                                f"[PluginLoader] Duplicate source name '{instance.name}' "
                                f"in {py_file.name} — skipping"
                            )
                            continue
                        loaded_names.add(instance.name)
                        sources.append(instance)
                        logger.info(
                            f"[PluginLoader] Loaded source: {instance.name!r} "
                            f"(Tier {instance.tier}) from {py_file.name}"
                        )

            except Exception as exc:
                logger.error(
                    f"[PluginLoader] Failed to load {py_file.name}: {exc}",
                    exc_info=True,
                )
                continue  # Never fail the whole loader for one broken plugin

        # Sort by tier (ascending), then by name for stability
        sources.sort(key=lambda s: (s.tier, s.name))

        tiers = {1: [], 2: [], 3: []}
        for s in sources:
            tiers.get(s.tier, []).append(s.name)

        logger.info(
            f"[PluginLoader] Loaded {len(sources)} sources | "
            f"Tier 1: {tiers[1]} | Tier 2: {tiers[2]} | Tier 3: {tiers[3]}"
        )
        return sources

    def _import_module(self, py_file: Path):
        """Dynamically import a Python file as a module."""
        module_name = f"discovery.sources.{py_file.stem}"
        try:
            spec = importlib.util.spec_from_file_location(module_name, py_file)
            if spec is None or spec.loader is None:
                return None
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            return module
        except Exception as exc:
            logger.error(f"[PluginLoader] Import error for {py_file.name}: {exc}")
            return None
