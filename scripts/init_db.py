#!/usr/bin/env python3
"""
BlueSME Database Initializer

Creates all PostgreSQL tables from SQLAlchemy models.
Safe to run multiple times (CREATE IF NOT EXISTS).

Usage:
    python scripts/init_db.py
    python scripts/init_db.py --check   # just verify connection
"""

import argparse
import os
import sys

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(project_root, ".env"))

from backend.db.session import init_db, check_connection
from backend.utils.logger import get_logger

logger = get_logger("init_db")


def main():
    parser = argparse.ArgumentParser(description="Initialize BlueSME database")
    parser.add_argument("--check", action="store_true", help="Only verify DB connection")
    args = parser.parse_args()

    logger.info("BlueSME DB Initializer starting...")

    if not check_connection():
        logger.error("Cannot connect to database. Check POSTGRES_* env vars.")
        sys.exit(1)

    logger.info("Database connection OK.")

    if args.check:
        logger.info("Connection check passed. Exiting.")
        return

    init_db()
    logger.info("All tables created / verified.")
    logger.info("Ready to accept data.")


if __name__ == "__main__":
    main()
