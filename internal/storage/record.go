package storage

import (
	"time"

	"can/internal/types"
)

type ClientRecord struct {
	ID                       string         `json:"id" gorm:"primaryKey;size:64"`
	Name                     string         `json:"name" gorm:"size:128;index"`
	Tag                      string         `json:"tag" gorm:"size:64"`
	Provider                 types.Provider `json:"provider" gorm:"size:32;index"`
	Endpoint                 string         `json:"endpoint" gorm:"size:512"`
	Region                   string         `json:"region" gorm:"size:64"`
	UseSSL                   bool           `json:"useSSL"`
	Port                     int            `json:"port"`
	EncryptedAccessKeyID     string         `json:"encryptedAccessKeyId" gorm:"type:text"`
	EncryptedSecretAccessKey string         `json:"encryptedSecretAccessKey" gorm:"type:text"`
	EncryptedSessionToken    string         `json:"encryptedSessionToken" gorm:"type:text"`
	CreatedAt                time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt                time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`

	AccessKeyID     string `gorm:"-"`
	SecretAccessKey string `gorm:"-"`
	SessionToken    string `gorm:"-"`
}

func (ClientRecord) TableName() string {
	return "clients"
}
