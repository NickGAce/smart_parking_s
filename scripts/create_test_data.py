import sys
import os

# Добавляем корневую директорию проекта в sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import AsyncSession, engine
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from sqlalchemy.future import select
import asyncio


# Создаем тестовые данные
async def create_test_data():
    async with AsyncSession(engine) as session:
        # Создаем парковку
        parking_lot = ParkingLot(
            name="Test Parking Lot",
            address="123 Test St, Test City",
            total_spots=100,  # общее количество мест
            guest_spot_percentage=20,  # 20% мест для гостей
        )
        session.add(parking_lot)
        await session.commit()
        await session.refresh(parking_lot)

        # Создаем парковочные места
        for i in range(1, 21):  # 20 мест для теста
            spot = ParkingSpot(
                spot_number=i,
                status=SpotStatus.available,  # все места свободные
                type="available",
                parking_lot_id=parking_lot.id
            )
            session.add(spot)

        await session.commit()
        print("Test parking lot and spots created.")


# Для запуска в asyncio
async def main():
    await create_test_data()


if __name__ == "__main__":
    asyncio.run(main())
