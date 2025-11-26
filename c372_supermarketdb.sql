CREATE DATABASE IF NOT EXISTS `c372_supermarketdb`;
USE `c372_supermarketdb`;

----------------------------------------
-- Existing TABLE: products (UNCHANGED)
----------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productName` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `quantity` int NOT NULL,
  `price` double(10,2) NOT NULL,
  `image` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `products` VALUES
(1,'Apples',50,1.50,'apples.png'),
(2,'Bananas',75,0.80,'bananas.png'),
(3,'Milk',50,3.50,'milk.png'),
(4,'Bread',80,1.80,'bread.png'),
(14,'Tomatoes',80,1.50,'tomatoes.png'),
(19,'Broccoli',100,5.00,'Broccoli.png');

----------------------------------------
-- Existing TABLE: users (UNCHANGED)
----------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `contact` varchar(10) NOT NULL,
  `role` varchar(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

INSERT INTO `users` VALUES
(1,'Peter Lim','peter@peter.com','7c4a8d09ca3762af61e59520943dc26494f8941b','Woodlands Ave 2','98765432','admin'),
(2,'Mary Tan','mary@mary.com','7c4a8d09ca3762af61e59520943dc26494f8941b','Tampines Ave 1','12345678','user'),
(3,'bobochan','bobochan@gmail.com','7c4a8d09ca3762af61e59520943dc26494f8941b','Woodlands','98765432','user'),
(4,'sarahlee','sarahlee@gmail.com','7c4a8d09ca3762af61e59520943dc26494f8941b','Woodlands','98765432','user');

----------------------------------------
-- NEW TABLE: carts (Persistent Cart)
----------------------------------------
DROP TABLE IF EXISTS `carts`;
CREATE TABLE `carts` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

----------------------------------------
-- NEW TABLE: cart_items
----------------------------------------
DROP TABLE IF EXISTS `cart_items`;
CREATE TABLE `cart_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `cart_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB;

----------------------------------------
-- NEW TABLE: orders
----------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `total` DECIMAL(10,2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

----------------------------------------
-- NEW TABLE: order_items
----------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `price` DECIMAL(10,2) NOT NULL,
    `quantity` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB;
