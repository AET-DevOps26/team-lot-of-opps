package com.lotofopps.backend.service;

import com.lotofopps.backend.exception.DuplicateDocumentException;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.repository.DocumentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

@Service
public class DocumentStorageService {

    private final Path storageRoot;
    private final DocumentRepository documentRepository;

    public DocumentStorageService(
            @Value("${storage.location:./uploads}") String storageLocation,
            DocumentRepository documentRepository) throws IOException {
        this.storageRoot = Paths.get(storageLocation).toAbsolutePath().normalize();
        this.documentRepository = documentRepository;
        Files.createDirectories(this.storageRoot);
    }

    public Document store(MultipartFile file, String userId) throws IOException {
        byte[] bytes = file.getBytes();
        String hash = sha256Hex(bytes);

        // documentRepository.findByContentHashAndUserId(hash, userId).ifPresent(existing -> {
        //     throw new DuplicateDocumentException(existing);
        // });

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String extension = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : "";
        String storedFilename = UUID.randomUUID() + extension;
        Path destination = storageRoot.resolve(storedFilename);

        Files.write(destination, bytes);

        Document document = new Document(
                originalFilename,
                file.getContentType(),
                file.getSize(),
                destination.toString()
        );
        document.setUserId(userId);
        document.setContentHash(hash);
        return documentRepository.save(document);
    }

    public Resource load(String storagePath) throws MalformedURLException {
        Path file = Paths.get(storagePath);
        Resource resource = new UrlResource(file.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new IllegalArgumentException("File not found: " + storagePath);
        }
        return resource;
    }

    public void deleteFile(String storagePath) throws IOException {
        if (storagePath != null) {
            Files.deleteIfExists(Paths.get(storagePath));
        }
    }

    private static String sha256Hex(byte[] data) throws IOException {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IOException("SHA-256 unavailable", e);
        }
    }
}
