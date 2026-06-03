package com.lotofopps.backend.dto;

import java.util.List;

public class RagQueryResponse {

    private String query;
    private List<RagResult> results;
    private int totalFound;

    public RagQueryResponse(String query, List<RagResult> results, int totalFound) {
        this.query = query;
        this.results = results;
        this.totalFound = totalFound;
    }

    public String getQuery() { return query; }
    public List<RagResult> getResults() { return results; }
    public int getTotalFound() { return totalFound; }
}
