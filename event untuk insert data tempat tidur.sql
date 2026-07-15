

-- Membuang struktur basisdata untuk informasi
USE `informasi`;

-- membuang struktur untuk event informasi.refreshDataTempatTidur
DROP EVENT IF EXISTS `refreshDataTempatTidur`;
DELIMITER //
CREATE EVENT `refreshDataTempatTidur` ON SCHEDULE EVERY 12 HOUR STARTS NOW() ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
	
	DECLARE VSUCCESS TINYINT DEFAULT TRUE;
	
	BEGIN
		DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET VSUCCESS = FALSE;
		CALL informasi.executeJumlahTempatTidur();
	END;
  
END//
DELIMITER ;

