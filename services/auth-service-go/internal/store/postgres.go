package store

import (
	"auth-service-go/internal/models"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

type Storage struct {
	DB *sqlx.DB
}

func NewStorage(connStr string) (*Storage, error) {
	const tries = 5
	const timeout = 2

	// prepare the driver (Lazy, doesn't actaully connect)
	db, err := sqlx.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}

	for i := range tries {
		err = db.Ping()
		if err == nil {
			return &Storage{DB: db}, nil
		}
		fmt.Printf("Database not ready... retrying in %ds (%d/%d)\n", timeout, i+1, tries)
		time.Sleep(timeout * time.Second)
	}

	return nil, fmt.Errorf("could not connect to database after retries: %v", err)
}

func (s *Storage) CreateUser(user *models.User, roleID int) error {
	query := `INSERT INTO users (email, user_name, hashed_password, user_role_id) 
			  VALUES ($1, $2, $3, $4) 
			  RETURNING user_id, user_name, email`

	return s.DB.QueryRow(query, user.Email, user.Username, user.Password, roleID).Scan(&user.ID, &user.Username, &user.Email)
}

func (s *Storage) UpdateLocation(latitude, longitude int) error {

}

func (s *Storage) GetUserRoleIDByName(roleName string) (int, error) {
	var roleID int
	query := `SELECT role_id FROM user_roles WHERE role_name = $1`
	err := s.DB.QueryRow(query, roleName).Scan(&roleID)

	if err != nil {
		return 0, err
	}

	return roleID, nil
}

func (s *Storage) GetUserRoleByID(roleID int) (string, error) {
	var roleName string
	query := `SELECT role_name FROM user_roles WHERE role_id = $1`
	err := s.DB.QueryRow(query, roleID).Scan(&roleName)

	if err != nil {
		return "", err
	}

	return roleName, nil
}

func (s *Storage) GetUserByID(ID int) (*models.UserPublic, error) {
	user := &models.UserPublic{}
	query := `SELECT email, user_name, role_name, user_id FROM users, user_roles WHERE user_id = $1 AND user_role_id = role_id`
	err := s.DB.QueryRow(query, ID).Scan(&user.Email, &user.Username, &user.Role, &user.ID)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT user_id, user_name, email, hashed_password, role_name 
			  FROM users, user_roles 
			  WHERE email = $1 AND users.user_role_id = user_roles.role_id`
	err := s.DB.QueryRow(query, email).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.Role)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Storage) SaveRefreshToken(userID int, token string, expiresAt time.Time) error {
	query := `INSERT INTO refresh_tokens (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)`
	_, err := s.DB.Exec(query, userID, token, expiresAt)
	return err
}

func (s *Storage) ValidateRefreshToken(token string) (int, error) {
	var userID int
	var expiresAt time.Time

	query := `SELECT user_id, expires_at FROM refresh_tokens WHERE refresh_token = $1`

	err := s.DB.QueryRow(query, token).Scan(&userID, &expiresAt)
	if err != nil {
		return 0, err
	}

	if time.Now().After(expiresAt) {
		s.DB.Exec("DELETE FROM refresh_tokens WHERE refresh_token = $1", token)
		return 0, errors.New("sqlx: no rows in result set")
	}

	return userID, nil
}

func (s *Storage) RevokeRefreshToken(token string) error {
	_, err := s.DB.Exec("DELETE FROM refresh_token WHERE refresh_token = $1", token)
	return err
}
