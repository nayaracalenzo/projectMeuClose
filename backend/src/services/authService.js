const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { conflictError, unauthorizedError } = require("../errors/AppError");
const repository = require("../repositories/usersRepository");

async function register({ name, email, password, username, roleId, active }) {
  const userExists = await repository.findUserByEmail(email);

  if (userExists) {
    throw conflictError("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await repository.createUser({
    name,
    email,
    username,
    roleId,
    active,
    password: hashedPassword,
  });

  return {
    id: user.idUser,
    name: user.name,
    email: user.email,
  };
}

async function login({ username, password }) {
  const normalizedUsername = username?.trim().toLowerCase();
  const user = await repository.findUserByUsername(normalizedUsername);

  if (!user) {
    throw unauthorizedError("Invalid credentials");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw unauthorizedError("Invalid credentials");
  }

  const token = jwt.sign(
    {
      id: user.idUser,
      email: user.email,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  return {
    user: {
      id: user.idUser,
      name: user.name,
      email: user.email,
      username: user.username,
    },
    token,
  };
}

module.exports = {
  register,
  login,
};
