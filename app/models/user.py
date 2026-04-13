import enum
from app.models.parking_spot import ParkingSpot
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.booking import Booking  # Импортируем модель Booking
from app.models.notification import Notification


class UserRole(str, enum.Enum):
    admin = "admin"
    uk = "uk"
    owner = "owner"
    tenant = "tenant"
    guard = "guard"



class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="owner")

    # Связь с парковочными местами
    spots: Mapped[list["ParkingSpot"]] = relationship("ParkingSpot", back_populates="owner")

    # Связь с бронями
    bookings: Mapped[list[Booking]] = relationship("Booking", back_populates="user")  # Добавляем связь с бронями
    notifications: Mapped[list[Notification]] = relationship("Notification", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
