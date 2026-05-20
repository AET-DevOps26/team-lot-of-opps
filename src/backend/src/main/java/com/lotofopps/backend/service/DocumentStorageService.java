package com.lotofopps.backend.service;

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
import java.nio.file.StandardCopyOption;
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
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String extension = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : "";
        String storedFilename = UUID.randomUUID() + extension;
        Path destination = storageRoot.resolve(storedFilename);

        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);

        Document document = new Document(
                originalFilename,
                file.getContentType(),
                file.getSize(),
                destination.toString()
        );
        document.setUserId(userId);
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
}
