package com.lotofopps.export.config;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * The Arbeitnehmer-Pauschbetrag (§9a EStG) per tax year — the Werbungskosten every employee is
 * granted without submitting any receipt.
 *
 * <p>It is set by legislation and changes between years, so it is configuration rather than a
 * constant. A year with no configured amount falls back to {@code defaultAmount}, which will be
 * wrong whenever the legislature last moved the figure — see application.properties.
 */
@Component
@ConfigurationProperties(prefix = "export.pauschbetrag")
public class PauschbetragTable {

    private BigDecimal defaultAmount = BigDecimal.ZERO;
    private Map<Integer, BigDecimal> byYear = new HashMap<>();

    public BigDecimal forYear(int year) {
        return byYear.getOrDefault(year, defaultAmount);
    }

    public BigDecimal getDefaultAmount() {
        return defaultAmount;
    }

    public void setDefaultAmount(BigDecimal defaultAmount) {
        this.defaultAmount = defaultAmount;
    }

    public Map<Integer, BigDecimal> getByYear() {
        return byYear;
    }

    public void setByYear(Map<Integer, BigDecimal> byYear) {
        this.byYear = byYear;
    }
}
