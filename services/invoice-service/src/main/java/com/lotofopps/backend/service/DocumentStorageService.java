package com.lotofopps.backend.service;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.repository.DocumentRepository;
import java.io.IOException;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;

@Service
public class DocumentStorageService {

    private final S3Client s3;
    private final String bucket;
    private final DocumentRepository documentRepository;
    private volatile boolean bucketEnsured = false;

    public DocumentStorageService(
            @Value("${storage.s3.endpoint:http://localhost:8333}") String endpoint,
            @Value("${storage.s3.bucket:invoices}") String bucket,
            @Value("${storage.s3.access-key:devkey}") String accessKey,
            @Value("${storage.s3.secret-key:devsecret}") String secretKey,
            @Value("${storage.s3.region:us-east-1}") String region,
            DocumentRepository documentRepository) {
        this.bucket = bucket;
        this.documentRepository = documentRepository;
        this.s3 =
                S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of(region))
                        .credentialsProvider(
                                StaticCredentialsProvider.create(
                                        AwsBasicCredentials.create(accessKey, secretKey)))
                        .serviceConfiguration(
                                S3Configuration.builder().pathStyleAccessEnabled(true).build())
                        .build();
    }

    public Document store(MultipartFile file, String userId) throws IOException {
        ensureBucket();
        byte[] bytes = file.getBytes();
        String hash = sha256Hex(bytes);

        String originalFilename =
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String extension =
                originalFilename.contains(".")
                        ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                        : "";
        String key = UUID.randomUUID() + extension;

        s3.putObject(
                b -> b.bucket(bucket).key(key).contentType(file.getContentType()),
                RequestBody.fromBytes(bytes));

        Document document =
                new Document(originalFilename, file.getContentType(), file.getSize(), key);
        document.setUserId(userId);
        document.setContentHash(hash);
        return documentRepository.save(document);
    }

    public Resource load(String key) {
        return new ByteArrayResource(loadBytes(key));
    }

    public byte[] loadBytes(String key) {
        return s3.getObject(b -> b.bucket(bucket).key(key), ResponseTransformer.toBytes())
                .asByteArray();
    }

    public void deleteFile(String key) {
        if (key != null) {
            s3.deleteObject(b -> b.bucket(bucket).key(key));
        }
    }

    private void ensureBucket() {
        if (bucketEnsured) return;
        try {
            s3.headBucket(b -> b.bucket(bucket));
        } catch (NoSuchBucketException e) {
            s3.createBucket(b -> b.bucket(bucket));
        }
        bucketEnsured = true;
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
