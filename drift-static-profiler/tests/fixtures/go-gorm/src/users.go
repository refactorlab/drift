package main

import (
	"fmt"

	"gorm.io/gorm"
)

type User struct {
	ID   uint
	Name string
}

func main() {
	var db *gorm.DB
	// GORM-AUTO-003: AutoMigrate at boot.
	db.AutoMigrate(&User{})
}

// NPlusOne — GORM-N1-001: First in for-range.
func NPlusOne(db *gorm.DB, ids []uint) []User {
	var out []User
	for _, id := range ids {
		var u User
		db.First(&u, id)
		out = append(out, u)
	}
	return out
}

// RawUnsafe — GORM-RAW-002: fmt.Sprintf in db.Raw.
func RawUnsafe(db *gorm.DB, name string) {
	db.Raw(fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name))
}

// SaveLoop — GORM-SAVE-004: db.Create in for-range.
func SaveLoop(db *gorm.DB, users []User) {
	for _, u := range users {
		db.Create(&u)
	}
}

// CleanBulkCreate — Negative: single bulk Create.
func CleanBulkCreate(db *gorm.DB, users []User) {
	db.Create(&users)
}
