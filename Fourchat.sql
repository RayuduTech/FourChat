-- MySQL dump 10.13  Distrib 8.4.0, for Win64 (x86_64)
--
-- Host: localhost    Database: Fourchat_db
-- ------------------------------------------------------
-- Server version	8.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `chat_participants`
--

DROP TABLE IF EXISTS `chat_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_participants` (
  `chat_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `chat_participants_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_participants`
--

LOCK TABLES `chat_participants` WRITE;
/*!40000 ALTER TABLE `chat_participants` DISABLE KEYS */;
INSERT INTO `chat_participants` VALUES (1,1,'2026-04-24 11:32:10'),(1,2,'2026-04-24 11:32:10'),(2,1,'2026-04-24 11:35:02'),(2,3,'2026-04-24 11:35:02'),(3,2,'2026-04-30 07:00:21'),(3,6,'2026-04-30 07:00:21'),(4,2,'2026-04-30 07:21:24'),(4,7,'2026-04-30 07:21:24');
/*!40000 ALTER TABLE `chat_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `is_group` tinyint(1) DEFAULT '0',
  `group_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chats`
--

LOCK TABLES `chats` WRITE;
/*!40000 ALTER TABLE `chats` DISABLE KEYS */;
INSERT INTO `chats` VALUES (1,0,NULL,'2026-04-24 11:32:10'),(2,0,NULL,'2026-04-24 11:35:02'),(3,0,NULL,'2026-04-30 07:00:21'),(4,0,NULL,'2026-04-30 07:21:24');
/*!40000 ALTER TABLE `chats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,22,2,'comment working','2026-05-04 03:17:06');
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `friendships`
--

DROP TABLE IF EXISTS `friendships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `friendships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id1` int NOT NULL,
  `user_id2` int NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `sender_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_friendship` (`user_id1`,`user_id2`),
  KEY `user_id2` (`user_id2`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `friendships_ibfk_1` FOREIGN KEY (`user_id1`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_ibfk_2` FOREIGN KEY (`user_id2`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_ibfk_3` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `friendships`
--

LOCK TABLES `friendships` WRITE;
/*!40000 ALTER TABLE `friendships` DISABLE KEYS */;
INSERT INTO `friendships` VALUES (1,6,7,'rejected',7,'2026-04-30 07:14:09','2026-04-30 07:14:21'),(3,2,7,'accepted',7,'2026-04-30 07:21:07','2026-04-30 07:21:13');
/*!40000 ALTER TABLE `friendships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `likes`
--

DROP TABLE IF EXISTS `likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_like` (`post_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `likes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `likes`
--

LOCK TABLES `likes` WRITE;
/*!40000 ALTER TABLE `likes` DISABLE KEYS */;
INSERT INTO `likes` VALUES (1,22,2,'2026-05-04 03:16:40');
/*!40000 ALTER TABLE `likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chat_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text,
  `media_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `chat_id` (`chat_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,2,3,'Hi',NULL,'2026-04-24 11:35:17'),(2,2,1,'Hi',NULL,'2026-04-24 11:35:51'),(3,2,3,'dfsdfds',NULL,'2026-04-24 11:36:14'),(4,2,3,'sasac',NULL,'2026-04-24 11:44:17'),(5,2,3,'nm,mn',NULL,'2026-04-24 12:03:25'),(6,3,2,'hi',NULL,'2026-04-30 07:00:33'),(7,4,7,'hi',NULL,'2026-04-30 07:21:28'),(8,4,2,'kk',NULL,'2026-04-30 09:21:15'),(9,4,7,'Sent an attachment','/uploads/1777543471537.sas','2026-04-30 10:04:31'),(10,4,7,'hi',NULL,'2026-05-04 03:04:48');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `content` text,
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
INSERT INTO `posts` VALUES (1,7,'ssss',NULL,'2026-04-30 08:59:29'),(2,7,'test post',NULL,'2026-04-30 09:00:08'),(3,7,'test post',NULL,'2026-04-30 09:10:22'),(4,7,'tesssss',NULL,'2026-04-30 09:20:38'),(5,2,'testttt',NULL,'2026-04-30 09:20:53'),(6,7,'testsssss post',NULL,'2026-04-30 09:22:17'),(7,7,'tttest posttttt',NULL,'2026-04-30 09:22:41'),(8,7,'sadds',NULL,'2026-04-30 09:47:34'),(9,7,'test post',NULL,'2026-04-30 09:47:52'),(10,7,'ddsvds',NULL,'2026-04-30 09:54:09'),(11,7,'esdfdsf',NULL,'2026-04-30 09:58:26'),(12,7,'asdsafdsad',NULL,'2026-04-30 09:59:07'),(13,7,'asdsasa',NULL,'2026-04-30 09:59:25'),(14,7,'adsafava',NULL,'2026-04-30 09:59:52'),(15,7,'dsacdscdsa',NULL,'2026-04-30 10:00:09'),(16,7,'fdsfsdfs',NULL,'2026-04-30 10:03:39'),(17,7,'sadsadsada',NULL,'2026-04-30 10:14:40'),(18,7,'cxzcds',NULL,'2026-04-30 10:15:04'),(19,7,'dsadsada',NULL,'2026-04-30 10:15:20'),(20,2,'fasfassd',NULL,'2026-04-30 10:15:28'),(21,7,'hiii',NULL,'2026-05-04 03:05:08'),(22,7,'hi',NULL,'2026-05-04 03:12:02'),(23,7,'Result Day!!!',NULL,'2026-05-04 03:18:53');
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('online','offline') DEFAULT 'offline',
  `last_seen` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_admin` tinyint(1) DEFAULT '0',
  `bio` text,
  `profile_pic` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'rayudu','somisettyrayudu@gmail.com','$2b$10$r5rdieJQSMmK.QmzO3QWqe9hrvhsS147t3X70KMXL/kSrH3xg4iPe','offline','2026-05-04 04:06:18','2026-04-24 11:13:30',0,NULL,NULL),(2,'pawan kalyan','pawankalyan@gmail.com','$2b$10$SuCKv3Qngjw1xIqoPNfi5O4W3GTUmj3gyt4Nz5tdpORuLxDoDir6e','offline','2026-05-04 06:54:56','2026-04-24 11:31:27',0,NULL,NULL),(3,'Trivikram','trivikram@gmail.com','$2b$10$X3eZhUSVUyudgvDl/rdHfuqK3fiOuCtuvhEO.xlfUCAH5Sx0hH2xy','online','2026-04-24 12:00:45','2026-04-24 11:34:38',0,NULL,NULL),(4,'admin','admin@fourchat.com','$2b$10$FDFGqcAMLv7WD1yU0vdMBug/vPpjXuGM4Vr.hrOY0x87T14jp33Ji','online','2026-04-24 11:50:47','2026-04-24 11:50:47',1,NULL,NULL),(6,'mark','mark@zoho.com','$2b$10$1UpZUHoJ.nQhwoDDl0klDuQMCABLZvOosxUw53de1.AvNXOhq4WTq','offline','2026-04-30 07:20:24','2026-04-30 06:52:32',0,NULL,NULL),(7,'test','test@gmail.com','$2b$10$OvKrU6UL97cpTbPEEKvCyu91JS7fsXbfSwQrE23FDUYR4te6v99E2','offline','2026-05-04 05:31:54','2026-04-30 07:13:51',0,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-04 12:55:09
