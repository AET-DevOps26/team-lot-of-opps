package com.lotofopps.backend.dto;

public class RagQueryRequest {

    private String query;
    private Integer limit;

    public RagQueryRequest() {}

    public RagQueryRequest(String query, Integer limit) {
        this.query = query;
        this.limit = limit;
    }

    public String getQuery() { return query; }
    public Integer getLimit() { return limit != null ? limit : 5; }
    public void setQuery(String query) { this.query = query; }
    public void setLimit(Integer limit) { this.limit = limit; }
}
